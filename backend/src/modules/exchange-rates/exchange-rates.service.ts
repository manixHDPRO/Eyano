import { HttpStatus, Injectable } from "@nestjs/common";
import { CurrencyCode, ExchangeRateType, Prisma } from "@prisma/client";
import { moneyString } from "../../common/money";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { UpdateExchangeRateDto } from "./dto/update-exchange-rate.dto";
import type { UpdateExchangeRatesPairDto } from "./dto/update-exchange-rates-pair.dto";
import { ExchangeRateNotificationsService } from "./exchange-rate-notifications.service";
import { EXCHANGE_RATES_AUDIT, EXCHANGE_RATES_ERROR } from "./exchange-rates.constants";

export type ExchangeRateRow = {
  id: string;
  rateType: ExchangeRateType;
  rate: number;
  validFrom: string;
  validTo: string | null;
  createdById: string;
  createdByName: string | null;
};

export type ExchangeRatesCurrent = {
  encaissement: ExchangeRateRow | null;
  decaissement: ExchangeRateRow | null;
};

export type ExchangeRateRevision = {
  validFrom: string;
  encaissementRate: number;
  decaissementRate: number | null;
  createdByName: string | null;
  note: string | null;
};

const personSelect = { id: true, firstName: true, lastName: true } as const;

@Injectable()
export class ExchangeRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly notifications: ExchangeRateNotificationsService,
  ) {}

  async current(): Promise<ExchangeRatesCurrent> {
    const rows = await this.prisma.exchangeRate.findMany({
      where: { validTo: null },
      include: { createdBy: { select: personSelect } },
    });
    const encaissement = rows.find((row) => row.rateType === ExchangeRateType.ENCAISSEMENT);
    const decaissement = rows.find((row) => row.rateType === ExchangeRateType.DECAISSEMENT);
    return {
      encaissement: encaissement ? toRow(encaissement) : null,
      decaissement: decaissement ? toRow(decaissement) : null,
    };
  }

  async history(rateType: ExchangeRateType, take = 30): Promise<{ items: ExchangeRateRow[] }> {
    const rows = await this.prisma.exchangeRate.findMany({
      where: { rateType },
      orderBy: { validFrom: "desc" },
      take,
      include: { createdBy: { select: personSelect } },
    });
    return { items: rows.map(toRow) };
  }

  async revisions(take = 30): Promise<{ items: ExchangeRateRevision[] }> {
    const limit = Math.min(100, Math.max(take, take * 3));
    const [encHistory, decHistory] = await Promise.all([
      this.history(ExchangeRateType.ENCAISSEMENT, limit),
      this.history(ExchangeRateType.DECAISSEMENT, limit),
    ]);

    const decByExact = new Map(decHistory.items.map((row) => [row.validFrom, row]));

    const draft: (ExchangeRateRevision & { encaissementId: string })[] = [];
    for (const enc of encHistory.items) {
      let dec = decByExact.get(enc.validFrom);
      if (!dec) {
        const encMs = new Date(enc.validFrom).getTime();
        dec = decHistory.items.find((row) => Math.abs(new Date(row.validFrom).getTime() - encMs) <= 2_000);
      }
      draft.push({
        validFrom: enc.validFrom,
        encaissementRate: enc.rate,
        decaissementRate: dec?.rate ?? null,
        createdByName: enc.createdByName ?? dec?.createdByName ?? null,
        note: null,
        encaissementId: enc.id,
      });
      if (draft.length >= take) {
        break;
      }
    }

    const entityIds = draft.map((row) => row.encaissementId);
    const audits =
      entityIds.length > 0
        ? await this.prisma.auditLog.findMany({
            where: {
              entityId: { in: entityIds },
              action: AUDIT_ACTION.EXCHANGE_RATE_UPDATED,
              entityType: AUDIT_ENTITY.EXCHANGE_RATE,
            },
            select: { entityId: true, newValue: true },
          })
        : [];

    const noteByEntity = new Map<string, string | null>();
    for (const row of audits) {
      const reason = extractAuditReason(row.newValue);
      if (reason) {
        noteByEntity.set(row.entityId, reason);
      }
    }

    const items: ExchangeRateRevision[] = draft.map(({ encaissementId, ...rest }) => ({
      ...rest,
      note: noteByEntity.get(encaissementId) ?? null,
    }));

    return { items };
  }

  async update(actor: AuthUser, dto: UpdateExchangeRateDto, meta: RequestMeta): Promise<ExchangeRateRow> {
    if (!Number.isFinite(dto.rate) || dto.rate <= 0) {
      throw invalidRate();
    }

    const created = await this.prisma.$transaction(async (tx) => {
      return this.replaceOpenRate(tx, actor, meta, {
        rateType: dto.rateType,
        rate: dto.rate,
        reason: dto.reason,
        now: new Date(),
        notify: true,
      });
    });

    return toRow(created);
  }

  async updatePair(actor: AuthUser, dto: UpdateExchangeRatesPairDto, meta: RequestMeta): Promise<ExchangeRatesCurrent> {
    if (!Number.isFinite(dto.encaissementRate) || dto.encaissementRate <= 0 || !Number.isFinite(dto.decaissementRate) || dto.decaissementRate <= 0) {
      throw invalidRate();
    }

    const reason = dto.reason?.trim() || "Mise à jour administrative";

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const encRow = await this.replaceOpenRate(tx, actor, meta, {
        rateType: ExchangeRateType.ENCAISSEMENT,
        rate: dto.encaissementRate,
        reason,
        now,
        notify: false,
      });
      const decRow = await this.replaceOpenRate(tx, actor, meta, {
        rateType: ExchangeRateType.DECAISSEMENT,
        rate: dto.decaissementRate,
        reason,
        now,
        notify: false,
      });

      await this.notifications.notifyPairChanged(tx, {
        encaissementRate: moneyString(Number(encRow.rate), 6),
        decaissementRate: moneyString(Number(decRow.rate), 6),
        entityId: encRow.id,
      });
    });

    return this.current();
  }

  private async replaceOpenRate(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    meta: RequestMeta,
    input: {
      rateType: ExchangeRateType;
      rate: number;
      reason?: string;
      now: Date;
      notify: boolean;
    },
  ) {
    const nextRate = moneyString(input.rate, 6);

    const open = await tx.exchangeRate.findFirst({
      where: { rateType: input.rateType, validTo: null },
      orderBy: { validFrom: "desc" },
    });
    const previousRate = open ? moneyString(Number(open.rate), 6) : null;

    if (open) {
      await tx.exchangeRate.update({
        where: { id: open.id },
        data: { validTo: input.now },
      });
    }

    const row = await tx.exchangeRate.create({
      data: {
        rateType: input.rateType,
        baseCurrency: CurrencyCode.USD,
        quoteCurrency: CurrencyCode.CDF,
        rate: nextRate,
        validFrom: input.now,
        createdById: actor.id,
      },
      include: { createdBy: { select: personSelect } },
    });

    const reason = input.reason?.trim() || null;

    await this.audit.write(
      {
        actorId: actor.id,
        action: AUDIT_ACTION.EXCHANGE_RATE_UPDATED,
        entityType: AUDIT_ENTITY.EXCHANGE_RATE,
        entityId: row.id,
        oldValue: previousRate ? { rate: previousRate, rateType: input.rateType } : null,
        newValue: {
          audit: EXCHANGE_RATES_AUDIT.UPDATED,
          rateType: input.rateType,
          rate: nextRate,
          reason,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      tx,
    );

    if (input.notify) {
      await this.notifications.notifyRateChanged(tx, {
        rateType: input.rateType,
        previousRate,
        nextRate,
        entityId: row.id,
      });
    }

    return row;
  }
}

function toRow(row: Prisma.ExchangeRateGetPayload<{ include: { createdBy: { select: typeof personSelect } } }>): ExchangeRateRow {
  return {
    id: row.id,
    rateType: row.rateType,
    rate: Number(row.rate),
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo?.toISOString() ?? null,
    createdById: row.createdById,
    createdByName: row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim() : null,
  };
}

function extractAuditReason(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const reason = (value as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function invalidRate(): ApiException {
  return new ApiException(EXCHANGE_RATES_ERROR.INVALID_RATE, "Taux invalide.", HttpStatus.BAD_REQUEST);
}