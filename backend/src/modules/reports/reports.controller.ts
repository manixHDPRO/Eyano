import { Controller, Get, Query } from "@nestjs/common";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import { ReportsOverviewQueryDto } from "./dto/reports-overview.query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("overview")
  @RequirePermission("reports.read")
  @StoreScoped("query", "storeId")
  overview(@CurrentUser() actor: AuthUser, @Query() query: ReportsOverviewQueryDto) {
    return this.reports.overview(actor, query);
  }
}