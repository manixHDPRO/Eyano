import { Controller, Get, Query } from "@nestjs/common";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs.query.dto";
import { AuditLogsService } from "./audit-logs.service";

@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get("catalog")
  @RequirePermission("audit.read")
  catalog() {
    return this.auditLogs.catalog();
  }

  @Get("summary")
  @RequirePermission("audit.read")
  @StoreScoped("query", "storeId")
  summary(@CurrentUser() actor: AuthUser, @Query("storeId") storeId?: string) {
    return this.auditLogs.summary(actor, storeId);
  }

  @Get()
  @RequirePermission("audit.read")
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListAuditLogsQueryDto) {
    return this.auditLogs.list(actor, query);
  }
}
