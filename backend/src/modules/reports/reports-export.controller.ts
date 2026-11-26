import { Controller, Get, Query, StreamableFile } from "@nestjs/common";
import { createHash } from "node:crypto";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import { ReportsExportService } from "./reports-export.service";
import { ReportsOverviewQueryDto } from "./dto/reports-overview.query.dto";

@Controller("reports/export")
export class ReportsExportController {
  constructor(private readonly exports: ReportsExportService) {}

  @Get("sales.xlsx")
  @RequirePermission("reports.read")
  @StoreScoped("query", "storeId")
  async salesExcel(@CurrentUser() actor: AuthUser, @Query() query: ReportsOverviewQueryDto) {
    const buffer = await this.exports.salesExcel(actor, query);
    return fileResponse(buffer, `eyano-ventes-${fileStamp(query)}.xlsx`, xlsxContentType());
  }

  @Get("stocks.xlsx")
  @RequirePermission("reports.read")
  @StoreScoped("query", "storeId")
  async stocksExcel(@CurrentUser() actor: AuthUser, @Query() query: ReportsOverviewQueryDto) {
    const buffer = await this.exports.stockExcel(actor, query);
    return fileResponse(buffer, `eyano-stocks-${fileStamp(query)}.xlsx`, xlsxContentType());
  }

  @Get("overview.pdf")
  @RequirePermission("reports.read")
  @StoreScoped("query", "storeId")
  async overviewPdf(@CurrentUser() actor: AuthUser, @Query() query: ReportsOverviewQueryDto) {
    const buffer = await this.exports.overviewPdf(actor, query);
    return fileResponse(buffer, `eyano-rapport-${fileStamp(query)}.pdf`, "application/pdf");
  }
}

function fileResponse(buffer: Buffer, filename: string, type: string): StreamableFile {
  return new StreamableFile(buffer, {
    type,
    length: buffer.length,
    disposition: `attachment; filename="${filename}"`,
  });
}

function xlsxContentType(): string {
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function fileStamp(query: ReportsOverviewQueryDto): string {
  const key = JSON.stringify({
    from: query.from ?? "",
    to: query.to ?? "",
    store: query.storeId ?? "",
  });
  return createHash("sha256").update(key).digest("hex").slice(0, 8);
}