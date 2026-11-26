import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { SequencesModule } from "../../common/sequences/sequences.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { PaymentsModule } from "../payments/payments.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [AccessModule, AuditLogsModule, SequencesModule, StockMovementsModule, PaymentsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}