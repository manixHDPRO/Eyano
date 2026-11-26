import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CentralWarehouseAdjustDto } from "./dto/central-warehouse-adjust.dto";
import { CentralWarehouseReceiveDto } from "./dto/central-warehouse-receive.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { CentralWarehouseService } from "./central-warehouse.service";
import { WarehousesService } from "./warehouses.service";

@Controller("warehouses")
export class WarehousesController {
  constructor(
    private readonly warehouses: WarehousesService,
    private readonly centralWarehouse: CentralWarehouseService,
  ) {}

  @Get("central/dashboard")
  @RequirePermission("stock.read")
  centralDashboard() {
    return this.centralWarehouse.dashboard();
  }

  @Post("central/receive")
  @HttpCode(201)
  @RequirePermission(["receipts.validate", "suppliers.manage"])
  centralReceive(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: CentralWarehouseReceiveDto,
  ) {
    return this.centralWarehouse.receive(actor, dto, meta);
  }

  @Post("central/adjust")
  @HttpCode(200)
  @RequirePermission("stock.adjust")
  centralAdjust(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: CentralWarehouseAdjustDto,
  ) {
    return this.centralWarehouse.adjust(actor, dto, meta);
  }

  @Get()
  @RequirePermission(["stores.manage", "stock.read"])
  list() {
    return this.warehouses.list();
  }

  @Get(":id")
  @RequirePermission(["stores.manage", "stock.read"])
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.warehouses.findOne(id);
  }

  @Patch(":id")
  @RequirePermission("stores.manage")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(actor, id, dto, meta);
  }
}
