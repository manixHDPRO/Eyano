import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ExchangeRateNotificationsService } from "./exchange-rate-notifications.service";
import { ExchangeRatesController } from "./exchange-rates.controller";
import { ExchangeRatesService } from "./exchange-rates.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, ExchangeRateNotificationsService],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}