import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PaymentMethod, TransferStatus } from "@prisma/client";
import type {
  ReportsCashVariance,
  ReportsOverviewResponse,
  ReportsRecentSale,
  ReportsStockRow,
  ReportsStoreRow,
  ReportsTopProduct,
  ReportsActiveTransfer,
} from "./reports.types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FOOTER_LIMIT = 42;
const STOCK_PREVIEW = 15;

const INK = rgb(0.059, 0.09, 0.165);
const MUTED = rgb(0.28, 0.333, 0.412);
const LINE = rgb(0.886, 0.91, 0.941);
const SOFT = rgb(0.973, 0.98, 0.988);
const WHITE = rgb(1, 1, 1);
const NAVY = rgb(0.059, 0.09, 0.165);
const ORANGE = rgb(0.957, 0.478, 0.071);
const GREEN = rgb(0.016, 0.471, 0.341);
const RED = rgb(0.725, 0.11, 0.11);

type Rgb = ReturnType<typeof rgb>;
type FontKind = "regular" | "bold";

type Column<T> = {
  title: string;
  width: number;
  align: "left" | "right";
  value: (row: T) => string;
  tone?: (row: T) => Rgb;
};

class ReportDocument {
  page!: PDFPage;
  y = PAGE_HEIGHT;

  constructor(
    readonly pdf: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {}

  font(kind: FontKind): PDFFont {
    return kind === "bold" ? this.bold : this.regular;
  }

  addPage(continued: boolean): void {
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 11, width: PAGE_WIDTH, height: 3, color: ORANGE });
    if (continued) {
      this.drawText("Eyano", MARGIN_X, PAGE_HEIGHT - 28, 9, "bold", INK);
      const label = "Synthèse";
      const width = this.bold.widthOfTextAtSize(pdfSafe(label), 9);
      this.drawText(label, PAGE_WIDTH - MARGIN_X - width, PAGE_HEIGHT - 28, 9, "bold", ORANGE);
      this.y = PAGE_HEIGHT - 44;
      return;
    }
    this.y = PAGE_HEIGHT - 28;
  }

  ensure(height: number): void {
    if (this.y - height < FOOTER_LIMIT) {
      this.addPage(true);
    }
  }

  drawText(text: string, x: number, y: number, size: number, kind: FontKind, color: Rgb): void {
    const safe = pdfSafe(text);
    if (!safe) {
      return;
    }
    this.page.drawText(safe, { x, y, size, font: this.font(kind), color });
  }

  clip(text: string, width: number, size: number, kind: FontKind): string {
    const font = this.font(kind);
    const safe = pdfSafe(text);
    if (font.widthOfTextAtSize(safe, size) <= width) {
      return safe;
    }
    const ellipsis = "...";
    let end = safe.length;
    while (end > 0 && font.widthOfTextAtSize(`${safe.slice(0, end)}${ellipsis}`, size) > width) {
      end -= 1;
    }
    return end === 0 ? "" : `${safe.slice(0, end)}${ellipsis}`;
  }

  widthOf(text: string, size: number, kind: FontKind): number {
    return this.font(kind).widthOfTextAtSize(pdfSafe(text), size);
  }

  stampFooters(): void {
    const pages = this.pdf.getPages();
    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN_X, y: 28 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: 28 },
        thickness: 0.6,
        color: LINE,
      });
      page.drawText(pdfSafe("Eyano · document interne"), {
        x: MARGIN_X,
        y: 14,
        size: 8,
        font: this.regular,
        color: MUTED,
      });
      const label = `Page ${index + 1} / ${pages.length}`;
      const width = this.regular.widthOfTextAtSize(label, 8);
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN_X - width,
        y: 14,
        size: 8,
        font: this.regular,
        color: MUTED,
      });
    });
  }
}

export async function renderOverviewPdf(data: ReportsOverviewResponse): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Eyano - Rapport de synthese");
  pdf.setAuthor("Eyano");
  pdf.setCreator("Eyano");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const doc = new ReportDocument(pdf, regular, bold);
  doc.addPage(false);
  paintCover(doc, data);
  paintKpis(doc, data);
  paintStores(doc, data);
  paintPayments(doc, data);
  paintProducts(doc, data);
  paintStock(doc, data);
  paintVariances(doc, data);
  paintSales(doc, data);
  paintTransfers(doc, data);
  doc.stampFooters();
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function paintCover(doc: ReportDocument, data: ReportsOverviewResponse): void {
  doc.drawText("Eyano", MARGIN_X, doc.y - 18, 20, "bold", INK);
  const badge = "Synthèse";
  const badgeWidth = doc.widthOf(badge, 12, "bold");
  doc.drawText(badge, PAGE_WIDTH - MARGIN_X - badgeWidth, doc.y - 16, 12, "bold", ORANGE);
  doc.drawText("Rapport & Exports", MARGIN_X, doc.y - 34, 10, "regular", MUTED);
  doc.page.drawRectangle({ x: MARGIN_X, y: doc.y - 44, width: 56, height: 3, color: ORANGE });
  doc.y -= 58;

  const meta = [
    { label: "Période", value: formatPeriod(data.period.from, data.period.to) },
    { label: "Périmètre", value: formatScope(data) },
    { label: "Généré le", value: formatDateTime(data.generatedAt) },
  ];
  const height = 46;
  doc.ensure(height);
  const top = doc.y;
  doc.page.drawRectangle({
    x: MARGIN_X,
    y: top - height,
    width: CONTENT_WIDTH,
    height,
    color: SOFT,
    borderColor: LINE,
    borderWidth: 0.7,
  });
  const columnWidth = CONTENT_WIDTH / meta.length;
  meta.forEach((item, index) => {
    const x = MARGIN_X + index * columnWidth;
    if (index > 0) {
      doc.page.drawLine({
        start: { x, y: top - 8 },
        end: { x, y: top - height + 8 },
        thickness: 0.6,
        color: LINE,
      });
    }
    doc.drawText(item.label.toUpperCase(), x + 12, top - 16, 7, "bold", MUTED);
    doc.drawText(doc.clip(item.value, columnWidth - 24, 9, "bold"), x + 12, top - 32, 9, "bold", INK);
  });
  doc.y = top - height - 14;

  const rates = formatRates(data);
  if (rates) {
    doc.ensure(16);
    doc.drawText(rates, MARGIN_X, doc.y - 10, 8, "regular", MUTED);
    doc.y -= 20;
  }
}

function paintKpis(doc: ReportDocument, data: ReportsOverviewResponse): void {
  const summary = data.financialSummary;
  const cards = [
    { label: "Chiffre d'affaires net", value: formatUsd(summary.revenueUsd), hint: `${summary.salesCount} vente(s)`, color: INK },
    { label: "Marge brute", value: formatUsd(summary.grossMarginUsd), hint: `Coût ${formatUsd(summary.costUsd)}`, color: moneyColor(summary.grossMarginUsd) },
    { label: "Résultat net", value: formatUsd(summary.netResultUsd), hint: `Dépenses ${formatUsd(summary.expensesUsd)}`, color: moneyColor(summary.netResultUsd) },
    { label: "Encaissements", value: formatUsd(summary.collectionsByCurrency.usd), hint: formatCdf(summary.collectionsByCurrency.cdf), color: INK },
  ];
  const gap = 8;
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 68;
  doc.ensure(cardHeight);
  const top = doc.y;
  cards.forEach((card, index) => {
    const x = MARGIN_X + index * (cardWidth + gap);
    doc.page.drawRectangle({
      x,
      y: top - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: WHITE,
      borderColor: LINE,
      borderWidth: 0.8,
    });
    doc.page.drawRectangle({ x, y: top - 3, width: cardWidth, height: 3, color: index === 2 ? ORANGE : NAVY });
    doc.drawText(doc.clip(card.label, cardWidth - 16, 7, "bold"), x + 8, top - 18, 7, "bold", MUTED);
    doc.drawText(doc.clip(card.value, cardWidth - 16, 11, "bold"), x + 8, top - 36, 11, "bold", card.color);
    doc.drawText(doc.clip(card.hint, cardWidth - 16, 7.5, "regular"), x + 8, top - 52, 7.5, "regular", MUTED);
  });
  doc.y = top - cardHeight - 8;

  const extras = [
    { label: "Remises", value: formatUsd(summary.discountsUsd) },
    { label: "Coût d'achat vendu", value: formatUsd(summary.costUsd) },
    { label: "Dépenses", value: formatUsd(summary.expensesUsd) },
    { label: "Ventes", value: String(summary.salesCount) },
  ];
  const stripHeight = 36;
  doc.ensure(stripHeight);
  const stripTop = doc.y;
  doc.page.drawRectangle({
    x: MARGIN_X,
    y: stripTop - stripHeight,
    width: CONTENT_WIDTH,
    height: stripHeight,
    color: SOFT,
  });
  const cell = CONTENT_WIDTH / extras.length;
  extras.forEach((item, index) => {
    const x = MARGIN_X + index * cell;
    doc.drawText(item.label.toUpperCase(), x + 10, stripTop - 14, 6.5, "bold", MUTED);
    doc.drawText(doc.clip(item.value, cell - 18, 9, "bold"), x + 10, stripTop - 27, 9, "bold", INK);
  });
  doc.y = stripTop - stripHeight - 16;
}

function paintStores(doc: ReportDocument, data: ReportsOverviewResponse): void {
  const rows = [...data.byStore].sort((a, b) => b.revenueUsd - a.revenueUsd || a.name.localeCompare(b.name, "fr"));
  sectionTitle(doc, "Ventes et dépenses par boutique", `${rows.length} boutique(s)`);
  const [code, name, count, revenue, expenses] = splitWidths([70, 190, 70, 96, 96]);
  drawTable(doc, rows, [
    { title: "Code", width: code, align: "left", value: (row: ReportsStoreRow) => row.code },
    { title: "Boutique", width: name, align: "left", value: (row) => row.name },
    { title: "Ventes", width: count, align: "right", value: (row) => formatQty(row.salesCount) },
    { title: "CA USD", width: revenue, align: "right", value: (row) => formatUsd(row.revenueUsd) },
    { title: "Dépenses", width: expenses, align: "right", value: (row) => formatUsd(row.expensesUsd) },
  ]);
}

function paintPayments(doc: ReportDocument, data: ReportsOverviewResponse): void {
  const rows = paymentRows(data);
  sectionTitle(doc, "Encaissements par moyen");
  const [method, count, total] = splitWidths([280, 110, 132]);
  drawTable(doc, rows, [
    { title: "Moyen", width: method, align: "left", value: (row) => paymentLabel(row.method) },
    { title: "Lignes", width: count, align: "right", value: (row) => formatQty(row.count) },
    { title: "Total USD", width: total, align: "right", value: (row) => formatUsd(row.totalUsd) },
  ]);
}

function paintProducts(doc: ReportDocument, data: ReportsOverviewResponse): void {
  sectionTitle(doc, "Top produits", "par chiffre d'affaires");
  const [reference, name, qty, revenue, margin] = splitWidths([78, 210, 58, 88, 88]);
  drawTable(doc, data.topProducts, [
    { title: "Référence", width: reference, align: "left", value: (row: ReportsTopProduct) => row.reference },
    { title: "Produit", width: name, align: "left", value: (row) => row.name },
    { title: "Qté", width: qty, align: "right", value: (row) => formatQty(row.qtySold) },
    { title: "CA USD", width: revenue, align: "right", value: (row) => formatUsd(row.revenueUsd) },
    {
      title: "Marge",
      width: margin,
      align: "right",
      value: (row) => formatUsd(row.marginUsd),
      tone: (row) => moneyColor(row.marginUsd),
    },
  ]);
}

function paintStock(doc: ReportDocument, data: ReportsOverviewResponse): void {
  if (!data.stock) {
    return;
  }
  const ranked = [...data.stock.rows].sort((a, b) => b.valuationUsd - a.valuationUsd || a.name.localeCompare(b.name, "fr"));
  const preview = ranked.slice(0, STOCK_PREVIEW);
  const hidden = data.stock.rows.length - preview.length;
  sectionTitle(
    doc,
    "Valorisation des stocks",
    `${formatUsd(data.stock.totalValuationUsd)} · ${formatQty(data.stock.totalUnits)} unités`,
  );
  if (hidden > 0 || data.stock.truncated) {
    const note = data.stock.truncated
      ? `Extrait des ${preview.length} articles les plus valorisés. La source est limitée à 300 lignes ; le détail complet est dans l'export Excel.`
      : `Extrait des ${preview.length} articles les plus valorisés. ${hidden} autre(s) article(s) dans l'export Excel.`;
    paintNote(doc, note);
  }
  if (data.stock.showWarehouse) {
    const [reference, name, warehouse, stores, total, valuation] = splitWidths([68, 175, 62, 62, 58, 97]);
    drawTable(doc, preview, [
      { title: "Référence", width: reference, align: "left", value: (row: ReportsStockRow) => row.reference },
      { title: "Produit", width: name, align: "left", value: (row) => row.name },
      { title: "Entrepôt", width: warehouse, align: "right", value: (row) => formatQty(row.warehouseQty) },
      { title: "Boutiques", width: stores, align: "right", value: (row) => formatQty(row.storesQty) },
      { title: "Total", width: total, align: "right", value: (row) => formatQty(row.totalQty) },
      { title: "Valeur", width: valuation, align: "right", value: (row) => formatUsd(row.valuationUsd) },
    ]);
    return;
  }
  const [reference, name, stores, total, valuation] = splitWidths([78, 215, 70, 62, 97]);
  drawTable(doc, preview, [
    { title: "Référence", width: reference, align: "left", value: (row: ReportsStockRow) => row.reference },
    { title: "Produit", width: name, align: "left", value: (row) => row.name },
    { title: "Boutiques", width: stores, align: "right", value: (row) => formatQty(row.storesQty) },
    { title: "Total", width: total, align: "right", value: (row) => formatQty(row.totalQty) },
    { title: "Valeur", width: valuation, align: "right", value: (row) => formatUsd(row.valuationUsd) },
  ]);
}

function paintVariances(doc: ReportDocument, data: ReportsOverviewResponse): void {
  sectionTitle(doc, "Écarts de clôture caisse");
  const [store, register, closed, usd, cdf] = splitWidths([130, 110, 118, 82, 82]);
  drawTable(doc, data.cashVariances, [
    { title: "Boutique", width: store, align: "left", value: (row: ReportsCashVariance) => row.storeName },
    { title: "Caisse", width: register, align: "left", value: (row) => row.registerLabel },
    { title: "Clôture", width: closed, align: "left", value: (row) => formatDateTime(row.closedAt) },
    {
      title: "Écart USD",
      width: usd,
      align: "right",
      value: (row) => formatUsd(row.varianceUsd),
      tone: (row) => varianceColor(row.varianceUsd, row.varianceCdf),
    },
    {
      title: "Écart CDF",
      width: cdf,
      align: "right",
      value: (row) => formatCdf(row.varianceCdf),
      tone: (row) => varianceColor(row.varianceUsd, row.varianceCdf),
    },
  ]);
}

function paintSales(doc: ReportDocument, data: ReportsOverviewResponse): void {
  sectionTitle(doc, "Dernières ventes");
  const [number, store, when, total] = splitWidths([110, 190, 130, 92]);
  drawTable(doc, data.recentSales, [
    { title: "N°", width: number, align: "left", value: (row: ReportsRecentSale) => row.saleNumber },
    { title: "Boutique", width: store, align: "left", value: (row) => row.storeName },
    { title: "Date", width: when, align: "left", value: (row) => formatDateTime(row.completedAt) },
    { title: "Total", width: total, align: "right", value: (row) => formatUsd(row.totalUsd) },
  ]);
}

function paintTransfers(doc: ReportDocument, data: ReportsOverviewResponse): void {
  if (!data.activeTransfers) {
    return;
  }
  sectionTitle(doc, "Transferts en cours", `${data.activeTransfers.activeCount} dossier(s)`);
  const summary = transferSummary(data.activeTransfers.byStatus);
  if (summary) {
    paintNote(doc, summary);
  }
  const [reference, store, status, created] = splitWidths([110, 180, 130, 102]);
  drawTable(doc, data.activeTransfers.recent, [
    { title: "Référence", width: reference, align: "left", value: (row: ReportsActiveTransfer) => row.reference },
    { title: "Boutique", width: store, align: "left", value: (row) => row.storeName },
    { title: "Statut", width: status, align: "left", value: (row) => transferStatusLabel(row.status) },
    { title: "Créé le", width: created, align: "left", value: (row) => formatDateTime(row.createdAt) },
  ]);
}

function sectionTitle(doc: ReportDocument, title: string, hint?: string): void {
  doc.ensure(78);
  doc.y -= 6;
  const top = doc.y;
  doc.page.drawRectangle({ x: MARGIN_X, y: top - 14, width: 3, height: 14, color: ORANGE });
  doc.drawText(title, MARGIN_X + 10, top - 12, 11, "bold", INK);
  if (hint) {
    const size = 8;
    const clipped = doc.clip(hint, CONTENT_WIDTH * 0.48, size, "regular");
    const width = doc.widthOf(clipped, size, "regular");
    doc.drawText(clipped, MARGIN_X + CONTENT_WIDTH - width, top - 11, size, "regular", MUTED);
  }
  doc.y = top - 22;
}

function paintNote(doc: ReportDocument, text: string): void {
  const size = 8;
  const lines = wrap(doc, text, CONTENT_WIDTH, size, "regular");
  doc.ensure(lines.length * 12);
  for (const line of lines) {
    doc.drawText(line, MARGIN_X, doc.y - 9, size, "regular", MUTED);
    doc.y -= 12;
  }
  doc.y -= 4;
}

function drawTable<T>(doc: ReportDocument, rows: T[], columns: Array<Column<T>>): void {
  const headerHeight = 20;
  const rowHeight = 18;
  const paintHeader = () => {
    doc.ensure(headerHeight + rowHeight);
    const top = doc.y;
    doc.page.drawRectangle({
      x: MARGIN_X,
      y: top - headerHeight,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: NAVY,
    });
    let x = MARGIN_X;
    for (const column of columns) {
      const label = doc.clip(column.title, column.width - 14, 7.5, "bold");
      const textWidth = doc.widthOf(label, 7.5, "bold");
      const textX = column.align === "right" ? x + column.width - 8 - textWidth : x + 8;
      doc.drawText(label, textX, top - 13, 7.5, "bold", WHITE);
      x += column.width;
    }
    doc.y = top - headerHeight;
  };

  paintHeader();
  if (rows.length === 0) {
    doc.page.drawRectangle({ x: MARGIN_X, y: doc.y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: SOFT });
    doc.drawText("Aucune donnée sur la période.", MARGIN_X + 8, doc.y - 12, 8, "regular", MUTED);
    doc.y -= rowHeight + 12;
    return;
  }

  rows.forEach((row, index) => {
    if (doc.y - rowHeight < FOOTER_LIMIT) {
      paintHeader();
    }
    const top = doc.y;
    if (index % 2 === 1) {
      doc.page.drawRectangle({ x: MARGIN_X, y: top - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: SOFT });
    }
    doc.page.drawLine({
      start: { x: MARGIN_X, y: top - rowHeight },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: top - rowHeight },
      thickness: 0.4,
      color: LINE,
    });
    let x = MARGIN_X;
    for (const column of columns) {
      const label = doc.clip(column.value(row), column.width - 14, 8, "regular");
      const textWidth = doc.widthOf(label, 8, "regular");
      const textX = column.align === "right" ? x + column.width - 8 - textWidth : x + 8;
      doc.drawText(label, textX, top - 12, 8, "regular", column.tone?.(row) ?? INK);
      x += column.width;
    }
    doc.y = top - rowHeight;
  });
  doc.y -= 12;
}

function wrap(doc: ReportDocument, text: string, maxWidth: number, size: number, kind: FontKind): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (doc.widthOf(next, size, kind) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function splitWidths(parts: number[]): number[] {
  const sum = parts.reduce((total, part) => total + part, 0);
  const scaled = parts.map((part) => Math.floor((part / sum) * CONTENT_WIDTH * 100) / 100);
  const used = scaled.reduce((total, part) => total + part, 0);
  scaled[scaled.length - 1] = Math.round((scaled[scaled.length - 1] + (CONTENT_WIDTH - used)) * 100) / 100;
  return scaled;
}

function paymentRows(data: ReportsOverviewResponse): Array<{ method: PaymentMethod; count: number; totalUsd: number }> {
  const methods: PaymentMethod[] = ["CASH", "MPESA", "ORANGE_MONEY", "AIRTEL_MONEY"];
  return methods
    .flatMap((method) => {
      const stats = data.financialSummary.collectionsByMethod[method];
      if (!stats) {
        return [];
      }
      return [{ method, count: stats.count, totalUsd: stats.totalUsd }];
    })
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

function paymentLabel(method: PaymentMethod): string {
  switch (method) {
    case "CASH":
      return "Espèces";
    case "MPESA":
      return "M-Pesa";
    case "ORANGE_MONEY":
      return "Orange Money";
    case "AIRTEL_MONEY":
      return "Airtel Money";
    default: {
      const unexpected: never = method;
      return unexpected;
    }
  }
}

function transferStatusLabel(status: TransferStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "PENDING":
      return "En attente";
    case "VALIDATED":
      return "Validé";
    case "PREPARING":
      return "En préparation";
    case "SHIPPED":
      return "Expédié";
    case "PARTIALLY_RECEIVED":
      return "Partiellement réceptionné";
    case "RECEIVED":
      return "Réceptionné";
    case "CANCELLED":
      return "Annulé";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

const TRANSFER_ORDER: TransferStatus[] = [
  "DRAFT",
  "PENDING",
  "VALIDATED",
  "PREPARING",
  "SHIPPED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];

function transferSummary(byStatus: Partial<Record<TransferStatus, number>>): string {
  return TRANSFER_ORDER.filter((status) => (byStatus[status] ?? 0) > 0)
    .map((status) => `${transferStatusLabel(status)} ${byStatus[status]}`)
    .join("   ·   ");
}

function formatScope(data: ReportsOverviewResponse): string {
  if (!data.storeId) {
    return "Toutes les boutiques";
  }
  if (data.byStore.length === 1) {
    return `${data.byStore[0].code} — ${data.byStore[0].name}`;
  }
  const match = data.byStore.find((store) => store.storeId === data.storeId);
  return match ? `${match.code} — ${match.name}` : "Boutique sélectionnée";
}

function formatRates(data: ReportsOverviewResponse): string | null {
  const enc = data.exchangeRates.encaissementRate;
  const dec = data.exchangeRates.decaissementRate;
  if (enc == null && dec == null) {
    return null;
  }
  const encLabel = enc == null ? "—" : `${formatQty(enc)} CDF/USD`;
  const decLabel = dec == null ? "—" : `${formatQty(dec)} CDF/USD`;
  return `Taux actifs — encaissement ${encLabel} · décaissement ${decLabel}`;
}

function formatPeriod(from: string | null, to: string | null): string {
  if (!from && !to) {
    return "Tout l'historique";
  }
  return `${formatDay(from) ?? "..."} — ${formatDay(to) ?? "..."}`;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function formatDay(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDay(iso)} ${hours}:${minutes}`;
}

function formatUsd(value: number): string {
  return `${formatGrouped(value, 2)} USD`;
}

function formatCdf(value: number): string {
  return `${formatGrouped(value, 0)} CDF`;
}

function formatQty(value: number): string {
  return formatGrouped(value, Number.isInteger(value) ? 0 : 2);
}

function formatGrouped(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return decimals === 0 ? "0" : "0,00";
  }
  const sign = value < 0 ? "-" : "";
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction == null ? `${sign}${grouped}` : `${sign}${grouped},${fraction}`;
}

function moneyColor(value: number): Rgb {
  if (value < -0.004) {
    return RED;
  }
  if (value > 0.004) {
    return GREEN;
  }
  return INK;
}

function varianceColor(usd: number, cdf: number): Rgb {
  if (usd < -0.004 || cdf < -0.5) {
    return RED;
  }
  if (usd > 0.004 || cdf > 0.5) {
    return ORANGE;
  }
  return GREEN;
}

function pdfSafe(value: string): string {
  return value
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u0152/g, "OE")
    .replace(/\u0153/g, "oe")
    .replace(/[^\u0020-\u00FF]/g, "?");
}
