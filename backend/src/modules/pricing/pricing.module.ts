import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { PricingLedgerService } from "./pricing-ledger.service";
import { PricingNotificationsService } from "./pricing-notifications.service";
import { PricingController } from "./pricing.controller";
import { PricingService } from "./pricing.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [PricingController],
  providers: [PricingService, PricingLedgerService, PricingNotificationsService],
  exports: [PricingService, PricingLedgerService],
})
export class PricingModule {}