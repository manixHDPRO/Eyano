import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CashSessionsController } from "./cash-sessions.controller";
import { CashSessionsService } from "./cash-sessions.service";

@Module({
  imports: [AccessModule, AuditLogsModule],
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
  exports: [CashSessionsService],
})
export class CashSessionsModule {}