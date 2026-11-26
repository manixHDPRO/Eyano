import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CancelInventoryDto } from "./dto/cancel-inventory.dto";
import { CreateInventoryDto } from "./dto/create-inventory.dto";
import { ListInventoriesQueryDto } from "./dto/list-inventories.query.dto";
import { PatchInventoryItemsDto } from "./dto/patch-inventory-items.dto";
import { UpdateInventoryDto } from "./dto/update-inventory.dto";
import { INVENTORY_READ_PERMISSIONS } from "./inventory.constants";
import { InventoryService } from "./inventory.service";

@Controller("inventories")
export class InventoryController {
  constructor(private readonly inventories: InventoryService) {}

  @Get("summary")
  @RequirePermission(INVENTORY_READ_PERMISSIONS)
  summary(@CurrentUser() actor: AuthUser) {
    return this.inventories.summary(actor);
  }

  @Get("locations")
  @RequirePermission(INVENTORY_READ_PERMISSIONS)
  locations(@CurrentUser() actor: AuthUser) {
    return this.inventories.locations(actor);
  }

  @Get()
  @RequirePermission(INVENTORY_READ_PERMISSIONS)
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListInventoriesQueryDto) {
    return this.inventories.list(actor, query);
  }

  @Get(":id")
  @RequirePermission(INVENTORY_READ_PERMISSIONS)
  findOne(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.inventories.findOne(actor, id);
  }

  @Post()
  @RequirePermission("inventory.conduct")
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateInventoryDto) {
    return this.inventories.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("inventory.conduct")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.inventories.update(actor, id, dto, meta);
  }

  @Post(":id/start")
  @HttpCode(200)
  @RequirePermission("inventory.conduct")
  start(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.inventories.start(actor, id, meta);
  }

  @Patch(":id/items")
  @RequirePermission("inventory.conduct")
  patchItems(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchInventoryItemsDto,
  ) {
    return this.inventories.patchItems(actor, id, dto, meta);
  }

  @Post(":id/submit")
  @HttpCode(200)
  @RequirePermission("inventory.conduct")
  submit(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.inventories.submit(actor, id, meta);
  }

  @Post(":id/validate")
  @HttpCode(200)
  @RequirePermission("inventory.validate")
  validate(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.inventories.validate(actor, id, meta);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @RequirePermission(INVENTORY_READ_PERMISSIONS)
  cancel(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelInventoryDto,
  ) {
    return this.inventories.cancel(actor, id, dto, meta);
  }
}