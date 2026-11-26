import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CashRegistersController } from "./cash-registers.controller";
import { CashRegistersService } from "./cash-registers.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [CashRegistersController],
  providers: [CashRegistersService],
  exports: [CashRegistersService],
})
export class CashRegistersModule {}
