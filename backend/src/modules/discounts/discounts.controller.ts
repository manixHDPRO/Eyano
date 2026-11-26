import { Body, Controller, Param, ParseUUIDPipe, Patch } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { UpdateProductDiscountDto } from "../pricing/dto/update-product-discount.dto";
import { PricingService } from "../pricing/pricing.service";

/** Module remises — écritures historisées (palier 9). */
@Controller("discounts")
export class DiscountsController {
  constructor(private readonly pricing: PricingService) {}

  @Patch("products/:productId")
  @RequirePermission("discounts.update")
  updateDiscount(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDiscountDto,
  ) {
    return this.pricing.updateDiscount(actor, productId, dto, meta);
  }
}