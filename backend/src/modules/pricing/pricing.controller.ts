import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { ListPricingHistoryQueryDto } from "./dto/list-pricing-history.query.dto";
import { UpdateProductPricesDto } from "./dto/update-product-prices.dto";
import { PricingService } from "./pricing.service";

@Controller("pricing")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get("policy-check")
  @RequirePermission("prices.update")
  @HttpCode(HttpStatus.OK)
  policyCheck() {
    return { allowed: true };
  }

  @Get("overview")
  @RequirePermission(["products.read", "products.manage", "prices.update", "discounts.update"])
  overview(@CurrentUser() actor: AuthUser, @Query() query: ListPricingHistoryQueryDto) {
    return this.pricing.listRecentChanges(actor, query);
  }

  @Get("products/:productId")
  @RequirePermission(["products.read", "products.manage", "prices.update", "discounts.update"])
  timeline(@CurrentUser() actor: AuthUser, @Param("productId", ParseUUIDPipe) productId: string) {
    return this.pricing.getProductTimeline(actor, productId);
  }

  @Patch("products/:productId/prices")
  @RequirePermission("prices.update")
  updatePrices(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductPricesDto,
  ) {
    return this.pricing.updatePrices(actor, productId, dto, meta);
  }
}