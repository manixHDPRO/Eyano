import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { SequencesModule } from "../../common/sequences/sequences.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ExpenseNotificationsService } from "./expense-notifications.service";
import { ExpenseReceiptsService } from "./expense-receipts.service";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

@Module({
  imports: [PrismaModule, AccessModule, SequencesModule, AuditLogsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpenseReceiptsService, ExpenseNotificationsService],
  exports: [ExpensesService],
})
export class ExpensesModule {}