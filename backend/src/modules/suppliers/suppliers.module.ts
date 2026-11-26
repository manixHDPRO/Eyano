import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { GoodsReceiptsController } from "./goods-receipts.controller";
import { GoodsReceiptsService } from "./goods-receipts.service";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";

@Module({
  imports: [AuditLogsModule, StockMovementsModule],
  controllers: [SuppliersController, GoodsReceiptsController],
  providers: [SuppliersService, GoodsReceiptsService],
  exports: [SuppliersService, GoodsReceiptsService],
})
export class SuppliersModule {}