import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { CentralWarehouseService } from "./central-warehouse.service";
import { WarehousesController } from "./warehouses.controller";
import { WarehousesService } from "./warehouses.service";

@Module({
  imports: [AuditLogsModule, StockMovementsModule, SuppliersModule],
  controllers: [WarehousesController],
  providers: [WarehousesService, CentralWarehouseService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
