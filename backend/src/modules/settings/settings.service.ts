import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readBackupStatus, type BackupStatusSnapshot } from "../../common/ops/backup-status";
import { DocumentSequenceCode, Prisma, SettingValueType } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SETTINGS_ERROR, SETTING_READ_ONLY_KEYS, SETTINGS_GROUP_ORDER } from "./settings.constants";

export type AppSettingView = {
  key: string;
  group: string;
  value: unknown;
  valueType: SettingValueType;
  isCritical: boolean;
  description: string | null;
  readOnly: boolean;
};

export type SettingsListResponse = {
  items: AppSettingView[];
  saleNumberPrefix: string;
  backup: BackupStatusSnapshot | null;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  async list(): Promise<SettingsListResponse> {
    const [rows, saleSequence] = await Promise.all([
      this.prisma.appSetting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] }),
      this.prisma.documentSequence.findUnique({ where: { code: DocumentSequenceCode.SALE } }),
    ]);

    const order = new Map(SETTINGS_GROUP_ORDER.map((group, index) => [group, index]));
    const sorted = [...rows].sort((a, b) => {
      const ga = order.get(a.group as (typeof SETTINGS_GROUP_ORDER)[number]) ?? 99;
      const gb = order.get(b.group as (typeof SETTINGS_GROUP_ORDER)[number]) ?? 99;
      if (ga !== gb) {
        return ga - gb;
      }
      return a.key.localeCompare(b.key);
    });

    const backupStatusFile = this.config.get<string>("app.backupStatusFile", "");

    return {
      items: sorted.map((row) => toView(row)),
      saleNumberPrefix: saleSequence?.prefix ?? "VE",
      backup: readBackupStatus(backupStatusFile),
    };
  }

  async update(actor: AuthUser, dto: UpdateSettingsDto, meta: RequestMeta): Promise<SettingsListResponse> {
    const canUpdate = actor.permissions.includes("settings.update");
    const canUpdateCritical = actor.permissions.includes("settings.update_critical");

    if (!canUpdate && !canUpdateCritical) {
      throw new ApiException(
        SETTINGS_ERROR.FORBIDDEN_CRITICAL,
        "Vous n'avez pas la permission de modifier les paramètres.",
        HttpStatus.FORBIDDEN,
      );
    }

    const keys = [...new Set(dto.updates.map((item) => item.key))];
    const existingRows = await this.prisma.appSetting.findMany({ where: { key: { in: keys } } });
    const byKey = new Map(existingRows.map((row) => [row.key, row]));

    for (const item of dto.updates) {
      const existing = byKey.get(item.key);
      if (!existing) {
        throw new ApiException(SETTINGS_ERROR.UNKNOWN_KEY, `Paramètre inconnu : ${item.key}.`, HttpStatus.BAD_REQUEST);
      }
      if (SETTING_READ_ONLY_KEYS.has(item.key)) {
        throw new ApiException(
          SETTINGS_ERROR.READ_ONLY,
          `Le paramètre « ${existing.description ?? item.key} » n'est pas modifiable.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (existing.isCritical && !canUpdateCritical) {
        throw new ApiException(
          SETTINGS_ERROR.FORBIDDEN_CRITICAL,
          `Le paramètre critique « ${existing.description ?? item.key} » exige le rôle super administrateur.`,
          HttpStatus.FORBIDDEN,
        );
      }
      if (!existing.isCritical && !canUpdate) {
        throw new ApiException(
          SETTINGS_ERROR.FORBIDDEN_CRITICAL,
          "Vous n'avez pas la permission de modifier ces paramètres.",
          HttpStatus.FORBIDDEN,
        );
      }

      const nextValue = coerceAndValidate(existing.valueType, item.value, item.key);
      if (jsonEqual(existing.value, nextValue)) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.appSetting.update({
          where: { key: item.key },
          data: {
            value: nextValue as Prisma.InputJsonValue,
            updatedById: actor.id,
          },
        });
        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.SETTING_UPDATED,
            entityType: AUDIT_ENTITY.APP_SETTING,
            entityId: item.key,
            oldValue: { key: item.key, value: existing.value },
            newValue: { key: item.key, value: updated.value },
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
      });
    }

    return this.list();
  }
}

function toView(row: {
  key: string;
  group: string;
  value: unknown;
  valueType: SettingValueType;
  isCritical: boolean;
  description: string | null;
}): AppSettingView {
  return {
    key: row.key,
    group: row.group,
    value: row.value,
    valueType: row.valueType,
    isCritical: row.isCritical,
    description: row.description,
    readOnly: SETTING_READ_ONLY_KEYS.has(row.key),
  };
}

function coerceAndValidate(valueType: SettingValueType, raw: unknown, key: string): unknown {
  switch (valueType) {
    case SettingValueType.STRING: {
      if (typeof raw !== "string") {
        throw invalidValue(key);
      }
      return raw.trim();
    }
    case SettingValueType.NUMBER: {
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value)) {
        throw invalidValue(key);
      }
      return value;
    }
    case SettingValueType.BOOLEAN: {
      if (typeof raw === "boolean") {
        return raw;
      }
      if (raw === "true") {
        return true;
      }
      if (raw === "false") {
        return false;
      }
      throw invalidValue(key);
    }
    case SettingValueType.JSON: {
      if (key === "commercial.accepted_currencies") {
        if (!Array.isArray(raw) || !raw.every((entry) => typeof entry === "string" && entry.trim().length > 0)) {
          throw invalidValue(key);
        }
        return raw.map((entry) => entry.trim().toUpperCase());
      }
      if (raw === null || typeof raw !== "object") {
        throw invalidValue(key);
      }
      return raw;
    }
    default: {
      const unexpected: never = valueType;
      return unexpected;
    }
  }
}

function invalidValue(key: string): ApiException {
  return new ApiException(SETTINGS_ERROR.INVALID_VALUE, `Valeur invalide pour ${key}.`, HttpStatus.BAD_REQUEST);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}