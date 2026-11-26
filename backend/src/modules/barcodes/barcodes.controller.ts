import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { BarcodesService } from "./barcodes.service";
import { ListBarcodesQueryDto } from "./dto/list-barcodes.query.dto";
import { ListPrintLogsQueryDto } from "./dto/list-print-logs.query.dto";
import { LookupBarcodeQueryDto } from "./dto/lookup-barcode.query.dto";
import { PrintBarcodesDto } from "./dto/print-barcodes.dto";

@Controller("barcodes")
export class BarcodesController {
  constructor(private readonly barcodes: BarcodesService) {}

  @Get()
  @RequirePermission(["barcodes.print", "products.manage", "products.read"])
  list(@CurrentUser() actor: AuthUser, @Query() query: ListBarcodesQueryDto) {
    return this.barcodes.list(actor, query);
  }

  @Get("lookup")
  @RequirePermission(["barcodes.print", "products.manage", "products.read", "sales.create"])
  lookup(@CurrentUser() actor: AuthUser, @Query() query: LookupBarcodeQueryDto) {
    return this.barcodes.lookup(actor, query);
  }

  @Get("print-logs")
  @RequirePermission("barcodes.print")
  printLogs(@CurrentUser() actor: AuthUser, @Query() query: ListPrintLogsQueryDto) {
    return this.barcodes.listPrintLogs(actor, {
      page: query.page,
      pageSize: query.pageSize,
      productId: query.productId,
    });
  }

  @Post("missing")
  @RequirePermission("products.manage")
  @HttpCode(HttpStatus.OK)
  generateMissing(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta) {
    return this.barcodes.generateMissing(actor, meta);
  }

  @Post("print")
  @RequirePermission("barcodes.print")
  print(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: PrintBarcodesDto,
  ) {
    return this.barcodes.print(actor, { productIds: dto.productIds, copies: dto.copies }, meta);
  }

  @Post("products/:productId")
  @RequirePermission("products.manage")
  @HttpCode(HttpStatus.OK)
  generateOne(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return this.barcodes.generateForProduct(actor, productId, meta);
  }
}
