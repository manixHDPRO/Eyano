import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { TransferNotificationsService } from "./transfer-notifications.service";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [AuditLogsModule, StockMovementsModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransferNotificationsService],
  exports: [TransfersService],
})
export class TransfersModule {}
