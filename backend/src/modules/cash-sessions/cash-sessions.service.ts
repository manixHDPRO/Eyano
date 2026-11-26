import { HttpStatus, Injectable } from "@nestjs/common";
import {
  CashSessionStatus,
  ExpenseStatus,
  NotificationSeverity,
  NotificationType,
  Prisma,
  ReferentialStatus,
} from "@prisma/client";
import { computeCashSessionLedger } from "../../common/cash-session/cash-session-ledger.util";
import { AccessService } from "../../common/access/access.service";
import { moneyString } from "../../common/money";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { isPrismaUniqueViolation } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import {
  CASH_SESSION_AUDIT,
  CASH_SESSION_AUDIT_ENTITY,
  CASH_SESSION_ERROR,
} from "./cash-sessions.constants";
import type { CurrentCashSessionQueryDto } from "./dto/current-cash-session.query.dto";
import type { ListCashSessionsQueryDto } from "./dto/list-cash-sessions.query.dto";
import type { CloseCashSessionDto } from "./dto/close-cash-session.dto";
import type { OpenCashSessionDto } from "./dto/open-cash-session.dto";

const SETTING_NOTIFY_CASH_VARIANCE = "notifications.CASH_VARIANCE";

export type CashSessionListItem = {
  id: string;
  status: CashSessionStatus;
  openedAt: string;
  closedAt: string | null;
  openingFloatUsd: number;
  openingFloatCdf: number;
  store: { id: string; code: string; name: string };
  cashRegister: { id: string; code: string; name: string };
  openedByName: string;
  salesCount: number;
};

export type CashSessionDetail = {
  id: string;
  status: CashSessionStatus;
  openedAt: string;
  closedAt: string | null;
  openingFloatUsd: number;
  openingFloatCdf: number;
  collectionsUsd: number;
  collectionsCdf: number;
  expensesUsd: number;
  expensesCdf: number;
  theoreticalBalanceUsd: number;
  theoreticalBalanceCdf: number;
  countedUsd: number | null;
  countedCdf: number | null;
  varianceUsd: number | null;
  varianceCdf: number | null;
  note: string | null;
  cashRegister: {
    id: string;
    code: string;
    name: string;
    isDefault: boolean;
  };
  store: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
  };
  openedBy: { id: string; firstName: string; lastName: string };
  closedBy: { id: string; firstName: string; lastName: string } | null;
  salesCount: number;
};

const sessionInclude = {
  cashRegister: { include: { store: true } },
  openedBy: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { sales: true } },
} satisfies Prisma.CashSessionInclude;

@Injectable()
export class CashSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(actor: AuthUser, query: ListCashSessionsQueryDto) {
    const scope = this.buildListScope(actor, query.storeId);
    const where: Prisma.CashSessionWhereInput = {
      cashRegister: scope,
    };
    if (query.status) {
      where.status = query.status;
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.cashSession.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ openedAt: "desc" }],
        include: {
          cashRegister: { include: { store: { select: { id: true, code: true, name: true } } } },
          openedBy: { select: { firstName: true, lastName: true } },
          _count: { select: { sales: true } },
        },
      }),
      this.prisma.cashSession.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        openedAt: row.openedAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
        openingFloatUsd: Number(row.openingFloatUsd),
        openingFloatCdf: Number(row.openingFloatCdf),
        store: row.cashRegister.store,
        cashRegister: {
          id: row.cashRegister.id,
          code: row.cashRegister.code,
          name: row.cashRegister.name,
        },
        openedByName: `${row.openedBy.firstName} ${row.openedBy.lastName}`.trim(),
        salesCount: row._count.sales,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getById(actor: AuthUser, sessionId: string): Promise<CashSessionDetail> {
    const row = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: sessionInclude,
    });
    if (!row) {
      throw sessionNotFound();
    }
    this.assertStoreAccess(actor, row.cashRegister.storeId);
    return toDetail(
      row,
      await computeCashSessionLedger(
        this.prisma,
        row.id,
        Number(row.openingFloatUsd),
        Number(row.openingFloatCdf),
      ),
    );
  }

  async current(actor: AuthUser, query: CurrentCashSessionQueryDto): Promise<CashSessionDetail | null> {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id: query.cashRegisterId },
      include: { store: true },
    });
    if (!register || register.status !== ReferentialStatus.ACTIVE) {
      throw registerNotFound();
    }
    this.assertStoreAccess(actor, register.storeId);

    const row = await this.prisma.cashSession.findFirst({
      where: { cashRegisterId: query.cashRegisterId, status: CashSessionStatus.OPEN },
      include: sessionInclude,
    });
    if (!row) {
      return null;
    }
    return toDetail(row, await computeCashSessionLedger(this.prisma, row.id, Number(row.openingFloatUsd), Number(row.openingFloatCdf)));
  }

  async open(actor: AuthUser, dto: OpenCashSessionDto, meta: RequestMeta): Promise<CashSessionDetail> {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id: dto.cashRegisterId },
      include: { store: true },
    });
    if (!register || register.status !== ReferentialStatus.ACTIVE) {
      throw registerNotFound();
    }
    if (register.store.status !== ReferentialStatus.ACTIVE) {
      throw registerNotFound();
    }
    this.assertStoreAccess(actor, register.storeId);

    if (!Number.isFinite(dto.openingFloatUsd) || !Number.isFinite(dto.openingFloatCdf)) {
      throw invalidFloat();
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.cashSession.findFirst({
          where: { cashRegisterId: dto.cashRegisterId, status: CashSessionStatus.OPEN },
        });
        if (existing) {
          throw sessionAlreadyOpen();
        }

        const session = await tx.cashSession.create({
          data: {
            cashRegisterId: dto.cashRegisterId,
            openedById: actor.id,
            status: CashSessionStatus.OPEN,
            openingFloatUsd: moneyString(dto.openingFloatUsd),
            openingFloatCdf: moneyString(dto.openingFloatCdf, 0),
          },
          include: sessionInclude,
        });

        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.CASH_SESSION_OPENED,
            entityType: AUDIT_ENTITY.CASH_SESSION,
            entityId: session.id,
            storeId: register.storeId,
            oldValue: null,
            newValue: {
              audit: CASH_SESSION_AUDIT.OPENED,
              cashRegisterId: dto.cashRegisterId,
              openingFloatUsd: moneyString(dto.openingFloatUsd),
              openingFloatCdf: moneyString(dto.openingFloatCdf, 0),
            },
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );

        return session;
      });
      return toDetail(
        created,
        await computeCashSessionLedger(
          this.prisma,
          created.id,
          Number(created.openingFloatUsd),
          Number(created.openingFloatCdf),
        ),
      );
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      if (isPrismaUniqueViolation(error)) {
        throw sessionAlreadyOpen();
      }
      throw error;
    }
  }

  async close(actor: AuthUser, sessionId: string, dto: CloseCashSessionDto, meta: RequestMeta): Promise<CashSessionDetail> {
    if (!Number.isFinite(dto.countedUsd) || !Number.isFinite(dto.countedCdf)) {
      throw invalidCount();
    }

    const closed = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cashSession.findUnique({
        where: { id: sessionId },
        include: sessionInclude,
      });
      if (!row) {
        throw sessionNotFound();
      }
      if (row.status !== CashSessionStatus.OPEN) {
        throw sessionNotOpen();
      }

      const storeId = row.cashRegister.storeId;
      this.assertStoreAccess(actor, storeId);

      const pendingExpenses = await tx.expense.count({
        where: {
          cashRegisterId: row.cashRegisterId,
          status: ExpenseStatus.PENDING_CASHIER_CONFIRMATION,
        },
      });
      if (pendingExpenses > 0) {
        throw pendingCashierExpenses();
      }

      const openingUsd = Number(row.openingFloatUsd);
      const openingCdf = Number(row.openingFloatCdf);
      const ledger = await computeCashSessionLedger(
        tx as unknown as Parameters<typeof computeCashSessionLedger>[0],
        sessionId,
        openingUsd,
        openingCdf,
      );
      const expectedUsd = ledger.theoreticalBalanceUsd;
      const expectedCdf = ledger.theoreticalBalanceCdf;
      const varianceUsd = round2(dto.countedUsd - expectedUsd);
      const varianceCdf = round0(dto.countedCdf - expectedCdf);
      const closedAt = new Date();

      const updated = await tx.cashSession.update({
        where: { id: sessionId },
        data: {
          status: CashSessionStatus.CLOSED,
          closedAt,
          closedById: actor.id,
          expectedUsd: moneyString(expectedUsd),
          expectedCdf: moneyString(expectedCdf, 0),
          countedUsd: moneyString(dto.countedUsd),
          countedCdf: moneyString(dto.countedCdf, 0),
          varianceUsd: moneyString(varianceUsd),
          varianceCdf: moneyString(varianceCdf, 0),
          note: dto.note?.trim() ? dto.note.trim() : null,
        },
        include: sessionInclude,
      });

      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.CASH_SESSION_CLOSED,
          entityType: AUDIT_ENTITY.CASH_SESSION,
          entityId: sessionId,
          storeId,
          oldValue: { status: CashSessionStatus.OPEN },
          newValue: {
            audit: CASH_SESSION_AUDIT.CLOSED,
            expectedUsd: moneyString(expectedUsd),
            expectedCdf: moneyString(expectedCdf, 0),
            countedUsd: moneyString(dto.countedUsd),
            countedCdf: moneyString(dto.countedCdf, 0),
            varianceUsd: moneyString(varianceUsd),
            varianceCdf: moneyString(varianceCdf, 0),
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );

      if (Math.abs(varianceUsd) > 0.01 || Math.abs(varianceCdf) > 100) {
        if (await isNotificationEnabled(tx, SETTING_NOTIFY_CASH_VARIANCE)) {
          const registerLabel = `${updated.cashRegister.code} — ${updated.cashRegister.name}`;
          await tx.notification.create({
            data: {
              type: NotificationType.CASH_VARIANCE,
              severity: NotificationSeverity.WARNING,
              title: `Écart de clôture — ${registerLabel}`,
              body: `Écart constaté : ${formatSignedUsd(varianceUsd)} USD / ${formatSignedCdf(varianceCdf)} CDF (session ${sessionId.slice(0, 8)}…).`,
              entityType: CASH_SESSION_AUDIT_ENTITY,
              entityId: sessionId,
              storeId,
            },
          });
        }
      }

      return { session: updated, ledger };
    });

    return toDetail(closed.session, closed.ledger);
  }

  private buildListScope(actor: AuthUser, storeId?: string): Prisma.CashRegisterWhereInput {
    const context = {
      roleCode: actor.role.code,
      permissions: actor.permissions,
      storeIds: actor.stores.map((s) => s.id),
      stores: actor.stores,
      isGlobalScope: this.access.isGlobalRole(actor.role.code),
    };
    if (storeId) {
      if (!this.access.canAccessStore(context, storeId)) {
        return { id: { in: [] } };
      }
      return { storeId };
    }
    if (context.isGlobalScope) {
      return {};
    }
    if (context.storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: context.storeIds } };
  }

  private assertStoreAccess(actor: AuthUser, storeId: string): void {
    const context = {
      roleCode: actor.role.code,
      permissions: actor.permissions,
      storeIds: actor.stores.map((s) => s.id),
      stores: actor.stores,
      isGlobalScope: this.access.isGlobalRole(actor.role.code),
    };
    if (!this.access.canAccessStore(context, storeId)) {
      throw forbiddenStore();
    }
  }
}

function toDetail(
  row: Prisma.CashSessionGetPayload<{ include: typeof sessionInclude }>,
  ledger: Awaited<ReturnType<typeof computeCashSessionLedger>>,
): CashSessionDetail {
  const store = row.cashRegister.store;
  return {
    id: row.id,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    openingFloatUsd: Number(row.openingFloatUsd),
    openingFloatCdf: Number(row.openingFloatCdf),
    collectionsUsd: ledger.collectionsUsd,
    collectionsCdf: ledger.collectionsCdf,
    expensesUsd: ledger.expensesUsd,
    expensesCdf: ledger.expensesCdf,
    theoreticalBalanceUsd: ledger.theoreticalBalanceUsd,
    theoreticalBalanceCdf: ledger.theoreticalBalanceCdf,
    countedUsd: row.countedUsd != null ? Number(row.countedUsd) : null,
    countedCdf: row.countedCdf != null ? Number(row.countedCdf) : null,
    varianceUsd: row.varianceUsd != null ? Number(row.varianceUsd) : null,
    varianceCdf: row.varianceCdf != null ? Number(row.varianceCdf) : null,
    note: row.note,
    cashRegister: {
      id: row.cashRegister.id,
      code: row.cashRegister.code,
      name: row.cashRegister.name,
      isDefault: row.cashRegister.isDefault,
    },
    store: {
      id: store.id,
      code: store.code,
      name: store.name,
      city: store.city,
      receiptHeader: store.receiptHeader,
      receiptFooter: store.receiptFooter,
    },
    openedBy: row.openedBy,
    closedBy: row.closedBy,
    salesCount: row._count.sales,
  };
}

function registerNotFound(): ApiException {
  return new ApiException(CASH_SESSION_ERROR.REGISTER_NOT_FOUND, "Caisse introuvable.", HttpStatus.BAD_REQUEST);
}

function sessionAlreadyOpen(): ApiException {
  return new ApiException(
    CASH_SESSION_ERROR.SESSION_ALREADY_OPEN,
    "Une session est déjà ouverte sur cette caisse.",
    HttpStatus.CONFLICT,
  );
}

function invalidFloat(): ApiException {
  return new ApiException(CASH_SESSION_ERROR.INVALID_FLOAT, "Fond de caisse invalide.", HttpStatus.BAD_REQUEST);
}

function forbiddenStore(): ApiException {
  return new ApiException(CASH_SESSION_ERROR.FORBIDDEN_STORE, "Boutique hors de votre périmètre.", HttpStatus.FORBIDDEN);
}

function sessionNotFound(): ApiException {
  return new ApiException(CASH_SESSION_ERROR.SESSION_NOT_FOUND, "Session introuvable.", HttpStatus.NOT_FOUND);
}

function sessionNotOpen(): ApiException {
  return new ApiException(CASH_SESSION_ERROR.SESSION_NOT_OPEN, "Cette session n’est pas ouverte.", HttpStatus.CONFLICT);
}

function invalidCount(): ApiException {
  return new ApiException(CASH_SESSION_ERROR.INVALID_COUNT, "Comptage physique invalide.", HttpStatus.BAD_REQUEST);
}

function pendingCashierExpenses(): ApiException {
  return new ApiException(
    CASH_SESSION_ERROR.PENDING_EXPENSES,
    "Des dépenses tiroir attendent encore la confirmation caissière. Confirmez-les avant de clôturer.",
    HttpStatus.CONFLICT,
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round0(value: number): number {
  return Math.round(value);
}

function formatSignedUsd(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${round2(value).toFixed(2)}`;
}

function formatSignedCdf(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${round0(value)}`;
}

async function isNotificationEnabled(client: Prisma.TransactionClient, key: string): Promise<boolean> {
  const row = await client.appSetting.findUnique({ where: { key } });
  if (!row) {
    return false;
  }
  return row.value === true;
}