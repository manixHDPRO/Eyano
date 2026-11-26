import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { ReportsController } from "./reports.controller";
import { ReportsExportController } from "./reports-export.controller";
import { ReportsExportService } from "./reports-export.service";
import { ReportsService } from "./reports.service";

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [ReportsController, ReportsExportController],
  providers: [ReportsService, ReportsExportService],
})
export class ReportsModule {}