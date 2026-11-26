import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { DiscountsController } from "./discounts.controller";

@Module({
  imports: [PricingModule],
  controllers: [DiscountsController],
})
export class DiscountsModule {}