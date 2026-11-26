import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BarcodesModule } from "../barcodes/barcodes.module";
import { PricingModule } from "../pricing/pricing.module";
import { ProductPhotosService } from "./product-photos.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuditLogsModule, PricingModule, BarcodesModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductPhotosService],
  exports: [ProductsService],
})
export class ProductsModule {}
