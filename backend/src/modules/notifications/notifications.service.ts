import { HttpStatus, Injectable } from "@nestjs/common";
import { NotificationType, Prisma } from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListNotificationsQueryDto } from "./dto/list-notifications.query.dto";
import { NOTIFICATION_ERROR } from "./notifications.constants";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  severity: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  storeId: string | null;
  createdAt: string;
  readAt: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(actor: AuthUser, query: ListNotificationsQueryDto) {
    const where = await this.buildWhere(actor, query.storeId);
    if (query.unreadOnly) {
      where.readAt = null;
    }
    if (query.type) {
      where.type = query.type;
    }

    const scopeWhere = await this.buildWhere(actor, query.storeId);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { ...scopeWhere, readAt: null },
    });

    return {
      items: rows.map(toItem),
      unreadCount,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async markAllRead(actor: AuthUser, storeId?: string): Promise<{ updated: number }> {
    const where = await this.buildWhere(actor, storeId);
    where.readAt = null;
    const result = await this.prisma.notification.updateMany({
      where,
      data: { readAt: new Date(), readById: actor.id },
    });
    return { updated: result.count };
  }

  async unreadCount(actor: AuthUser, storeId: string | undefined, type?: NotificationType) {
    const where = await this.buildWhere(actor, storeId);
    where.readAt = null;
    if (type) {
      where.type = type;
    }
    const count = await this.prisma.notification.count({ where });
    return { count };
  }

  async markRead(actor: AuthUser, id: string) {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) {
      throw new ApiException(NOTIFICATION_ERROR.NOT_FOUND, "Notification introuvable.", HttpStatus.NOT_FOUND);
    }
    if (row.storeId) {
      await this.assertStoreAccess(actor, row.storeId);
    }
    if (row.readAt) {
      return toItem(row);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), readById: actor.id },
    });
    return toItem(updated);
  }

  private async buildWhere(actor: AuthUser, storeId?: string): Promise<Prisma.NotificationWhereInput> {
    const context = await this.access.loadContext(actor.id);
    if (storeId) {
      await this.assertStoreAccess(actor, storeId);
      return { storeId };
    }
    if (context.isGlobalScope) {
      return {};
    }
    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: storeIds } };
  }

  private async assertStoreAccess(actor: AuthUser, storeId: string): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.canAccessStore(context, storeId)) {
      throw new ApiException(
        NOTIFICATION_ERROR.FORBIDDEN_STORE,
        "Cette boutique ne fait pas partie de votre périmètre.",
        HttpStatus.FORBIDDEN,
      );
    }
  }
}

function toItem(row: {
  id: string;
  type: NotificationType;
  severity: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  storeId: string | null;
  createdAt: Date;
  readAt: Date | null;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    storeId: row.storeId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}