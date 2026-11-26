import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { ExpensesModule } from "../expenses/expenses.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AccessModule, ExpensesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}