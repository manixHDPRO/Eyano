import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { AuthUser } from "../../common/types/auth-user";
import type { ReportsOverviewQueryDto } from "./dto/reports-overview.query.dto";
import { renderOverviewPdf } from "./overview-pdf";
import { ReportsService } from "./reports.service";

@Injectable()
export class ReportsExportService {
  constructor(private readonly reports: ReportsService) {}

  async salesExcel(actor: AuthUser, query: ReportsOverviewQueryDto): Promise<Buffer> {
    const data = await this.reports.overview(actor, query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Eyano";

    const sheet = workbook.addWorksheet("Ventes par boutique");
    sheet.addRow(["Code boutique", "Boutique", "Nombre ventes", "CA USD", "Dépenses USD"]);
    for (const row of data.byStore) {
      sheet.addRow([row.code, row.name, row.salesCount, row.revenueUsd, row.expensesUsd]);
    }
    sheet.getRow(1).font = { bold: true };

    const summary = workbook.addWorksheet("Synthèse");
    summary.addRow(["Indicateur", "Valeur USD"]);
    summary.addRow(["Chiffre d'affaires", data.financialSummary.revenueUsd]);
    summary.addRow(["Coût vendu", data.financialSummary.costUsd]);
    summary.addRow(["Marge brute", data.financialSummary.grossMarginUsd]);
    summary.addRow(["Remises", data.financialSummary.discountsUsd]);
    summary.addRow(["Dépenses", data.financialSummary.expensesUsd]);
    summary.addRow(["Résultat net", data.financialSummary.netResultUsd]);
    summary.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async stockExcel(actor: AuthUser, query: ReportsOverviewQueryDto): Promise<Buffer> {
    const data = await this.reports.overview(actor, query);
    if (!data.stock) {
      return this.emptyWorkbook("Stocks", "Aucune donnée stock pour ce périmètre.");
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Eyano";
    const sheet = workbook.addWorksheet("Stocks");
    const headers = data.stock.showWarehouse
      ? ["Référence", "Désignation", "Entrepôt", "Boutiques", "Total", "Valorisation USD"]
      : ["Référence", "Désignation", "Boutiques", "Total", "Valorisation USD"];
    sheet.addRow(headers);
    for (const row of data.stock.rows) {
      if (data.stock.showWarehouse) {
        sheet.addRow([row.reference, row.name, row.warehouseQty, row.storesQty, row.totalQty, row.valuationUsd]);
      } else {
        sheet.addRow([row.reference, row.name, row.storesQty, row.totalQty, row.valuationUsd]);
      }
    }
    sheet.getRow(1).font = { bold: true };
    if (data.stock.truncated) {
      sheet.addRow([]);
      sheet.addRow(["Note", "Liste limitée aux 300 premières lignes (même règle que l'UI)."]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async overviewPdf(actor: AuthUser, query: ReportsOverviewQueryDto): Promise<Buffer> {
    const data = await this.reports.overview(actor, query);
    return renderOverviewPdf(data);
  }

  private async emptyWorkbook(title: string, message: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title);
    sheet.addRow([message]);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}