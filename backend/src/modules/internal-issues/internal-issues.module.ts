import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { InternalIssueNotificationsService } from "./internal-issue-notifications.service";
import { InternalIssuesController } from "./internal-issues.controller";
import { InternalIssuesService } from "./internal-issues.service";

@Module({
  imports: [AuditLogsModule, StockMovementsModule],
  controllers: [InternalIssuesController],
  providers: [InternalIssuesService, InternalIssueNotificationsService],
  exports: [InternalIssuesService],
})
export class InternalIssuesModule {}