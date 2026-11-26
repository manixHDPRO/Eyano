import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import { ListNotificationsQueryDto } from "./dto/list-notifications.query.dto";
import { NotificationsService } from "./notifications.service";

const NOTIFICATION_READ_PERMISSIONS = [
  "transfers.receive",
  "stock.read",
  "reports.read",
  "transfers.create",
  "transfers.validate",
];

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermission(NOTIFICATION_READ_PERMISSIONS)
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(actor, query);
  }

  @Get("unread-count")
  @RequirePermission(NOTIFICATION_READ_PERMISSIONS)
  @StoreScoped("query", "storeId")
  unreadCount(
    @CurrentUser() actor: AuthUser,
    @Query("storeId") storeId: string | undefined,
    @Query("type") type?: NotificationType,
  ) {
    return this.notifications.unreadCount(actor, storeId, type);
  }

  @Patch("read-all")
  @RequirePermission(NOTIFICATION_READ_PERMISSIONS)
  @StoreScoped("query", "storeId")
  markAllRead(@CurrentUser() actor: AuthUser, @Query("storeId") storeId?: string) {
    return this.notifications.markAllRead(actor, storeId);
  }

  @Patch(":id/read")
  @RequirePermission(NOTIFICATION_READ_PERMISSIONS)
  markRead(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.notifications.markRead(actor, id);
  }
}