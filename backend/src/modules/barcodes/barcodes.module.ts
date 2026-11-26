import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BarcodesController } from "./barcodes.controller";
import { BarcodesService } from "./barcodes.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [BarcodesController],
  providers: [BarcodesService],
  exports: [BarcodesService],
})
export class BarcodesModule {}
