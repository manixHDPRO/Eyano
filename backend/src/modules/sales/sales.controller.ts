import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { IdempotencyKey } from "../../common/decorators/idempotency-key.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { ListSalesQueryDto } from "./dto/list-sales.query.dto";
import { VoidSaleDto } from "./dto/void-sale.dto";
import { SalesService } from "./sales.service";

@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get("summary")
  @RequirePermission(["reports.read", "sales.void", "sales.create"])
  summary(@CurrentUser() actor: AuthUser) {
    return this.sales.summary(actor);
  }

  @Get()
  @RequirePermission(["reports.read", "sales.void", "sales.create"])
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListSalesQueryDto) {
    return this.sales.list(actor, query);
  }

  @Post()
  @RequirePermission("sales.create")
  create(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Body() dto: CreateSaleDto,
  ) {
    return this.sales.create(actor, dto, idempotencyKey, meta);
  }

  @Get(":id")
  @RequirePermission(["sales.create", "sales.void", "reports.read"])
  findOne(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.sales.findOne(actor, id);
  }

  @Post(":id/void")
  @HttpCode(200)
  @RequirePermission("sales.void")
  voidSale(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VoidSaleDto,
  ) {
    return this.sales.void(actor, id, dto, meta);
  }
}