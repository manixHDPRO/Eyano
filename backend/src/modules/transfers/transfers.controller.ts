import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CancelTransferDto } from "./dto/cancel-transfer.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ListTransfersQueryDto } from "./dto/list-transfers.query.dto";
import { ReceiveTransferDto } from "./dto/receive-transfer.dto";
import { SetTransferItemsDto } from "./dto/set-transfer-items.dto";
import { ShipTransferDto } from "./dto/ship-transfer.dto";
import { TransferCatalogQueryDto } from "./dto/transfer-catalog.query.dto";
import { UpdateTransferDto } from "./dto/update-transfer.dto";
import { TRANSFER_READ_PERMISSIONS } from "./transfers.constants";
import { TransfersService } from "./transfers.service";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get("summary")
  @RequirePermission(TRANSFER_READ_PERMISSIONS)
  summary(@CurrentUser() actor: AuthUser) {
    return this.transfers.summary(actor);
  }

  @Get("destinations")
  @RequirePermission(TRANSFER_READ_PERMISSIONS)
  destinations(@CurrentUser() actor: AuthUser) {
    return this.transfers.destinations(actor);
  }

  @Get("catalog")
  @RequirePermission(TRANSFER_READ_PERMISSIONS)
  catalog(@CurrentUser() actor: AuthUser, @Query() query: TransferCatalogQueryDto) {
    return this.transfers.catalog(actor, query);
  }

  @Get()
  @RequirePermission(TRANSFER_READ_PERMISSIONS)
  list(@CurrentUser() actor: AuthUser, @Query() query: ListTransfersQueryDto) {
    return this.transfers.list(actor, query);
  }

  @Get(":id")
  @RequirePermission(TRANSFER_READ_PERMISSIONS)
  findOne(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.transfers.findOne(actor, id);
  }

  @Post()
  @RequirePermission("transfers.create")
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateTransferDto) {
    return this.transfers.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("transfers.create")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransferDto,
  ) {
    return this.transfers.update(actor, id, dto, meta);
  }

  @Put(":id/items")
  @RequirePermission("transfers.create")
  setItems(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetTransferItemsDto,
  ) {
    return this.transfers.setItems(actor, id, dto, meta);
  }

  @Post(":id/submit")
  @HttpCode(200)
  @RequirePermission("transfers.create")
  submit(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.transfers.submit(actor, id, meta);
  }

  @Post(":id/validate")
  @HttpCode(200)
  @RequirePermission("transfers.validate")
  validate(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.transfers.validate(actor, id, meta);
  }

  @Post(":id/prepare")
  @HttpCode(200)
  @RequirePermission("transfers.prepare_ship")
  prepare(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.transfers.prepare(actor, id, meta);
  }

  @Post(":id/ship")
  @HttpCode(200)
  @RequirePermission("transfers.prepare_ship")
  ship(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ShipTransferDto,
  ) {
    return this.transfers.ship(actor, id, dto, meta);
  }

  @Post(":id/receive")
  @HttpCode(200)
  @RequirePermission("transfers.receive")
  receive(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReceiveTransferDto,
  ) {
    return this.transfers.receive(actor, id, dto, meta);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @RequirePermission(["transfers.create", "transfers.validate", "transfers.prepare_ship"])
  cancel(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelTransferDto,
  ) {
    return this.transfers.cancel(actor, id, dto, meta);
  }
}
