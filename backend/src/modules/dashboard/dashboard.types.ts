import type { CurrencyCode, PaymentMethod, TransferStatus } from "@prisma/client";

export type DashboardKpis = {
  totalSalesUsd: number;
  salesCount: number;
  totalDiscountsUsd: number;
  totalExpensesUsd: number;
  warehouseValueUsd: number | null;
  totalWarehouseUnits: number | null;
  activeStoresCount: number;
  pendingTransfersCount: number;
  openCashSessions: number;
  lowStockCount: number;
  stockoutCount: number;
};

export type DashboardExchangeRate = {
  encaissementRate: number | null;
  decaissementRate: number | null;
};

export type DashboardStorePerformance = {
  storeId: string;
  code: string;
  name: string;
  salesCount: number;
  revenueUsd: number;
  stockUnits: number;
};

export type DashboardLowStockAlert = {
  productId: string;
  reference: string;
  name: string;
  locationKind: "WAREHOUSE" | "STORE";
  locationName: string;
  quantity: number;
  threshold: number;
};

export type DashboardRecentSale = {
  id: string;
  saleNumber: string;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod | null;
  totalUsd: number;
  paidAmount: number;
  completedAt: string;
};

export type DashboardRecentTransfer = {
  id: string;
  transferNumber: string;
  status: TransferStatus;
  createdAt: string;
  storeName: string;
};

export type DashboardTodayExpensesSummary = {
  count: number;
  amountUsd: number;
  drawerUsd: number;
  pendingCashier: number;
};

export type DashboardTodayExpenseItem = {
  id: string;
  reference: string;
  status: string;
  category: string;
  amount: number;
  currency: CurrencyCode;
  amountUsdEquivalent: number;
  spentAt: string;
  locationName: string;
  fromCashDrawer: boolean;
  createdByName: string;
};

export type DashboardTodayExpenses = {
  summary: DashboardTodayExpensesSummary;
  items: DashboardTodayExpenseItem[];
};

export type AdminDashboardResponse = {
  kpis: DashboardKpis;
  exchangeRate: DashboardExchangeRate;
  salesByStore: DashboardStorePerformance[];
  lowStockAlerts: DashboardLowStockAlert[];
  recentSales: DashboardRecentSale[];
  recentTransfers: DashboardRecentTransfer[];
  todayExpenses: DashboardTodayExpenses;
};