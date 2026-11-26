import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { ListStockLevelsQueryDto } from "./dto/list-stock-levels.query.dto";
import { ListStockMovementsQueryDto } from "./dto/list-stock-movements.query.dto";
import { ManualAdjustmentDto } from "./dto/manual-adjustment.dto";
import { ReconcileStockQueryDto } from "./dto/reconcile-stock.query.dto";
import { StockQueryService } from "./stock-query.service";

@Controller("stock")
export class StockController {
  constructor(private readonly stock: StockQueryService) {}

  @Get("summary")
  @RequirePermission("stock.read")
  summary(@CurrentUser() actor: AuthUser) {
    return this.stock.summary(actor);
  }

  @Get("levels")
  @RequirePermission("stock.read")
  @StoreScoped("query", "storeId")
  listLevels(@CurrentUser() actor: AuthUser, @Query() query: ListStockLevelsQueryDto) {
    return this.stock.listLevels(actor, query);
  }

  @Get("movements")
  @RequirePermission("stock.read")
  @StoreScoped("query", "storeId")
  listMovements(@CurrentUser() actor: AuthUser, @Query() query: ListStockMovementsQueryDto) {
    return this.stock.listMovements(actor, query);
  }

  @Post("manual-adjustments")
  @HttpCode(200)
  @RequirePermission("stock.adjust")
  @StoreScoped("body", "storeId")
  manualAdjustment(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: ManualAdjustmentDto,
  ) {
    return this.stock.manualAdjustment(actor, dto, meta);
  }

  @Post("reconcile")
  @HttpCode(200)
  @RequirePermission("stock.read")
  reconcile(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Query() query: ReconcileStockQueryDto,
  ) {
    return this.stock.reconcile(actor, query, meta);
  }
}