import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AUDIT_ACTION,
  AUDIT_ACTION_DOMAIN,
  AUDIT_DOMAINS,
  AUDIT_ENTITY,
  AUDIT_ERROR,
  SENSITIVE_AUDIT_ACTIONS,
  actionsForDomain,
} from "./audit-logs.constants";
import { toAuditLogItem } from "./audit-logs.mapper";
import type { ListAuditLogsQueryDto } from "./dto/list-audit-logs.query.dto";

export type AuditWriteInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  storeId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

type DbClient = Prisma.TransactionClient | PrismaService;

const actorSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

const storeSelect = {
  id: true,
  code: true,
  name: true,
} as const;

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async write(input: AuditWriteInput, client: DbClient = this.prisma): Promise<void> {
    await client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        storeId: input.storeId ?? null,
        oldValue: toJson(input.oldValue),
        newValue: toJson(input.newValue),
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async list(actor: AuthUser, query: ListAuditLogsQueryDto) {
    const where = await this.buildWhere(actor, query);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: actorSelect },
          store: { select: storeSelect },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map(toAuditLogItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async summary(actor: AuthUser, storeId?: string) {
    const scope = await this.buildScopeWhere(actor, storeId);
    const today = startOfToday();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const sensitiveFilter: Prisma.AuditLogWhereInput = {
      ...scope,
      action: { in: [...SENSITIVE_AUDIT_ACTIONS] },
    };

    const [todayCount, last7DaysCount, sensitiveTodayCount, uniqueActorsToday] = await Promise.all([
      this.prisma.auditLog.count({ where: { ...scope, createdAt: { gte: today } } }),
      this.prisma.auditLog.count({ where: { ...scope, createdAt: { gte: weekAgo } } }),
      this.prisma.auditLog.count({ where: { ...sensitiveFilter, createdAt: { gte: today } } }),
      this.prisma.auditLog.findMany({
        where: { ...scope, createdAt: { gte: today }, actorId: { not: null } },
        distinct: ["actorId"],
        select: { actorId: true },
      }),
    ]);

    return {
      todayCount,
      last7DaysCount,
      sensitiveTodayCount,
      uniqueActorsToday: uniqueActorsToday.length,
    };
  }

  catalog() {
    const actions = (Object.values(AUDIT_ACTION) as string[]).map((value) => ({
      value,
      domain: AUDIT_ACTION_DOMAIN[value as keyof typeof AUDIT_ACTION_DOMAIN],
    }));
    const entityTypes = Object.values(AUDIT_ENTITY);
    return {
      domains: [...AUDIT_DOMAINS],
      actions,
      entityTypes,
    };
  }

  private async buildWhere(actor: AuthUser, query: ListAuditLogsQueryDto): Promise<Prisma.AuditLogWhereInput> {
    const where: Prisma.AuditLogWhereInput = {
      ...(await this.buildScopeWhere(actor, query.storeId)),
    };

    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.action?.trim()) {
      where.action = query.action.trim();
    }
    if (query.entityType?.trim()) {
      where.entityType = query.entityType.trim();
    }
    if (query.domain) {
      where.action = intersectActionFilter(where.action, actionsForDomain(query.domain));
    }
    if (query.sensitiveOnly) {
      where.action = intersectActionFilter(where.action, [...SENSITIVE_AUDIT_ACTIONS]);
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      createdAt.gte = new Date(query.from);
    }
    if (query.to) {
      createdAt.lte = new Date(query.to);
    }
    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const term = query.search?.trim();
    if (term) {
      where.OR = [
        { action: { contains: term, mode: "insensitive" } },
        { entityType: { contains: term, mode: "insensitive" } },
        { entityId: { contains: term, mode: "insensitive" } },
        { ip: { contains: term, mode: "insensitive" } },
        {
          actor: {
            is: {
              OR: [
                { email: { contains: term, mode: "insensitive" } },
                { firstName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          store: {
            is: {
              OR: [
                { code: { contains: term, mode: "insensitive" } },
                { name: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    return where;
  }

  private async buildScopeWhere(actor: AuthUser, storeId?: string): Promise<Prisma.AuditLogWhereInput> {
    const context = await this.access.loadContext(actor.id);
    if (storeId) {
      if (!this.access.canAccessStore(context, storeId)) {
        throw new ApiException(
          AUDIT_ERROR.FORBIDDEN_STORE,
          "Cette boutique ne fait pas partie de votre périmètre.",
          HttpStatus.FORBIDDEN,
        );
      }
      return { storeId };
    }
    if (context.isGlobalScope) {
      return {};
    }
    const storeIds = actor.stores.map((store) => store.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: storeIds } };
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function intersectActionFilter(
  current: Prisma.AuditLogWhereInput["action"],
  allowed: string[],
): Prisma.StringFilter | string {
  if (typeof current === "string") {
    return allowed.includes(current) ? current : "__none__";
  }
  if (current && typeof current === "object" && "in" in current && Array.isArray(current.in)) {
    const overlap = current.in.filter((value): value is string => typeof value === "string" && allowed.includes(value));
    return { in: overlap.length > 0 ? overlap : ["__none__"] };
  }
  return { in: allowed };
}
