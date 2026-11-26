import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { StockController } from "./stock.controller";
import { StockMovementsService } from "./stock-movements.service";
import { StockNotificationsService } from "./stock-notifications.service";
import { StockQueryService } from "./stock-query.service";

@Module({
  imports: [AuditLogsModule, AccessModule],
  controllers: [StockController],
  providers: [StockMovementsService, StockNotificationsService, StockQueryService],
  exports: [StockMovementsService, StockQueryService],
})
export class StockMovementsModule {}