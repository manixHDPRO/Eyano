import type { PaymentMethod, TransferStatus } from "@prisma/client";

export type ReportsFinancialSummary = {
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

export type ReportsStoreRow = {
  storeId: string;
  code: string;
  name: string;
  salesCount: number;
  revenueUsd: number;
  expensesUsd: number;
};

export type ReportsTopProduct = {
  productId: string;
  reference: string;
  name: string;
  qtySold: number;
  revenueUsd: number;
  marginUsd: number;
};

export type ReportsTopProductsResponse = {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  store: { id: string; code: string; name: string };
  items: ReportsTopProduct[];
  totalQtySold: number;
  totalRevenueUsd: number;
};

export type ReportsStockRow = {
  productId: string;
  reference: string;
  name: string;
  warehouseQty: number;
  storesQty: number;
  totalQty: number;
  valuationUsd: number;
  alertThreshold: number | null;
};

export type ReportsStockSection = {
  rows: ReportsStockRow[];
  totalValuationUsd: number;
  totalUnits: number;
  truncated: boolean;
  showWarehouse: boolean;
};

export type ReportsCashVariance = {
  sessionId: string;
  storeName: string;
  registerLabel: string;
  closedAt: string;
  varianceUsd: number;
  varianceCdf: number;
};

export type ReportsRecentSale = {
  id: string;
  saleNumber: string;
  storeName: string;
  totalUsd: number;
  completedAt: string;
};

export type ReportsActiveTransfer = {
  id: string;
  reference: string;
  status: TransferStatus;
  storeName: string;
  createdAt: string;
};

export type ReportsTransfersSection = {
  activeCount: number;
  byStatus: Partial<Record<TransferStatus, number>>;
  recent: ReportsActiveTransfer[];
};

export type ReportsOverviewResponse = {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  storeId: string | null;
  exchangeRates: {
    encaissementRate: number | null;
    decaissementRate: number | null;
  };
  financialSummary: ReportsFinancialSummary;
  byStore: ReportsStoreRow[];
  topProducts: ReportsTopProduct[];
  stock: ReportsStockSection | null;
  cashVariances: ReportsCashVariance[];
  recentSales: ReportsRecentSale[];
  activeTransfers: ReportsTransfersSection | null;
};