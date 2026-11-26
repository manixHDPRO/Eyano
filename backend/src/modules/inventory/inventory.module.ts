import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { InventoryNotificationsService } from "./inventory-notifications.service";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [AuditLogsModule, StockMovementsModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryNotificationsService],
  exports: [InventoryService],
})
export class InventoryModule {}