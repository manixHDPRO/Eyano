import { apiDownload, triggerBrowserDownload } from "./download";
import { apiRequest } from "./client";
import type { PaymentMethod } from "./types";

export type ReportsOverviewParams = {
  storeId?: string;
  from?: string;
  to?: string;
};

export type ReportsOverview = {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  storeId: string | null;
  exchangeRates: {
    encaissementRate: number | null;
    decaissementRate: number | null;
  };
  financialSummary: {
    revenueUsd: number;
    costUsd: number;
    grossMarginUsd: number;
    discountsUsd: number;
    expensesUsd: number;
    netResultUsd: number;
    salesCount: number;
    collectionsByCurrency: { usd: number; cdf: number };
    collectionsByMethod: Partial<Record<PaymentMethod, { count: number; totalUsd: number }>>;
  };
  byStore: Array<{
    storeId: string;
    code: string;
    name: string;
    salesCount: number;
    revenueUsd: number;
    expensesUsd: number;
  }>;
  topProducts: Array<{
    productId: string;
    reference: string;
    name: string;
    qtySold: number;
    revenueUsd: number;
    marginUsd: number;
  }>;
  stock: {
    rows: Array<{
      productId: string;
      reference: string;
      name: string;
      warehouseQty: number;
      storesQty: number;
      totalQty: number;
      valuationUsd: number;
      alertThreshold: number | null;
    }>;
    totalValuationUsd: number;
    totalUnits: number;
    truncated: boolean;
    showWarehouse: boolean;
  } | null;
  cashVariances: Array<{
    sessionId: string;
    storeName: string;
    registerLabel: string;
    closedAt: string;
    varianceUsd: number;
    varianceCdf: number;
  }>;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    storeName: string;
    totalUsd: number;
    completedAt: string;
  }>;
  activeTransfers: {
    activeCount: number;
    byStatus: Partial<Record<string, number>>;
    recent: Array<{
      id: string;
      reference: string;
      status: string;
      storeName: string;
      createdAt: string;
    }>;
  } | null;
};

function buildReportsQuery(params: ReportsOverviewParams = {}): string {
  const search = new URLSearchParams();
  if (params.storeId) {
    search.set("storeId", params.storeId);
  }
  if (params.from) {
    search.set("from", params.from);
  }
  if (params.to) {
    search.set("to", params.to);
  }
  return search.toString();
}

export function fetchReportsOverview(params: ReportsOverviewParams = {}): Promise<ReportsOverview> {
  const query = buildReportsQuery(params);
  return apiRequest(`/reports/overview${query ? `?${query}` : ""}`);
}

export type ReportsTopProductsParams = {
  storeId: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type ReportsTopProductsResult = {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  store: { id: string; code: string; name: string };
  items: Array<{
    productId: string;
    reference: string;
    name: string;
    qtySold: number;
    revenueUsd: number;
    marginUsd: number;
  }>;
  totalQtySold: number;
  totalRevenueUsd: number;
};

export function fetchReportsTopProducts(params: ReportsTopProductsParams): Promise<ReportsTopProductsResult> {
  const search = new URLSearchParams();
  search.set("storeId", params.storeId);
  if (params.from) {
    search.set("from", params.from);
  }
  if (params.to) {
    search.set("to", params.to);
  }
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  return apiRequest(`/reports/top-products?${search.toString()}`);
}

export async function downloadReportsSalesExcel(params: ReportsOverviewParams = {}): Promise<void> {
  const query = buildReportsQuery(params);
  const { blob, filename } = await apiDownload(`/reports/export/sales.xlsx${query ? `?${query}` : ""}`);
  triggerBrowserDownload(filename ?? "eyano-ventes.xlsx", blob);
}

export async function downloadReportsStocksExcel(params: ReportsOverviewParams = {}): Promise<void> {
  const query = buildReportsQuery(params);
  const { blob, filename } = await apiDownload(`/reports/export/stocks.xlsx${query ? `?${query}` : ""}`);
  triggerBrowserDownload(filename ?? "eyano-stocks.xlsx", blob);
}

export async function downloadReportsOverviewPdf(params: ReportsOverviewParams = {}): Promise<void> {
  const query = buildReportsQuery(params);
  const { blob, filename } = await apiDownload(`/reports/export/overview.pdf${query ? `?${query}` : ""}`);
  const pdfBlob = blob.type.includes("pdf") ? blob : new Blob([blob], { type: "application/pdf" });
  triggerBrowserDownload(filename ?? "eyano-rapport.pdf", pdfBlob);
}