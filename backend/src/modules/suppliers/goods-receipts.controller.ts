import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { ListGoodsReceiptsQueryDto } from "./dto/list-goods-receipts.query.dto";
import { SetGoodsReceiptItemsDto } from "./dto/set-goods-receipt-items.dto";
import { UpdateGoodsReceiptDto } from "./dto/update-goods-receipt.dto";
import { GoodsReceiptsService } from "./goods-receipts.service";

@Controller("goods-receipts")
export class GoodsReceiptsController {
  constructor(private readonly receipts: GoodsReceiptsService) {}

  @Get()
  @RequirePermission(["suppliers.manage", "suppliers.read"])
  list(@Query() query: ListGoodsReceiptsQueryDto) {
    return this.receipts.list(query);
  }

  @Get(":id")
  @RequirePermission(["suppliers.manage", "suppliers.read"])
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.findOne(id);
  }

  @Post()
  @RequirePermission("suppliers.manage")
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateGoodsReceiptDto) {
    return this.receipts.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("suppliers.manage")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoodsReceiptDto,
  ) {
    return this.receipts.update(actor, id, dto, meta);
  }

  @Put(":id/items")
  @RequirePermission("suppliers.manage")
  setItems(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetGoodsReceiptItemsDto,
  ) {
    return this.receipts.setItems(actor, id, dto, meta);
  }

  @Post(":id/validate")
  @HttpCode(200)
  @RequirePermission("receipts.validate")
  validate(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.receipts.validate(actor, id, meta);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @RequirePermission("suppliers.manage")
  cancel(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.receipts.cancel(actor, id, meta);
  }
}