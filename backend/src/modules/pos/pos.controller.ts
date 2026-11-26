import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import { PosCatalogQueryDto } from "./dto/pos-catalog.query.dto";
import { PosDailySalesReportQueryDto } from "./dto/pos-daily-sales-report.query.dto";
import { PosService } from "./pos.service";

@Controller("pos")
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Get("workspace")
  @RequirePermission(["sales.create", "cash.session"])
  workspace(@CurrentUser() actor: AuthUser) {
    return this.pos.workspace(actor);
  }

  @Get("catalog")
  @RequirePermission(["sales.create", "cash.session"])
  @StoreScoped("query", "storeId")
  catalog(@CurrentUser() actor: AuthUser, @Query() query: PosCatalogQueryDto) {
    return this.pos.catalog(actor, query.storeId, query.search);
  }

  @Get("daily-sales-report")
  @RequirePermission(["sales.create", "cash.session"])
  @StoreScoped("query", "storeId")
  dailySalesReport(@CurrentUser() actor: AuthUser, @Query() query: PosDailySalesReportQueryDto) {
    return this.pos.dailySalesReport(actor, query);
  }
}