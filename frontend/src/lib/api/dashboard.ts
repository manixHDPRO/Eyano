import { apiRequest } from "./client";
import type { ExpenseCategoryCode, ExpenseStatus, PaymentMethod, TransferStatus } from "./types";

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

export type AdminDashboardPayload = {
  kpis: DashboardKpis;
  exchangeRate: {
    encaissementRate: number | null;
    decaissementRate: number | null;
  };
  salesByStore: Array<{
    storeId: string;
    code: string;
    name: string;
    salesCount: number;
    revenueUsd: number;
    stockUnits: number;
  }>;
  lowStockAlerts: Array<{
    productId: string;
    reference: string;
    name: string;
    locationKind: "WAREHOUSE" | "STORE";
    locationName: string;
    quantity: number;
    threshold: number;
  }>;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    currency: "USD" | "CDF";
    paymentMethod: PaymentMethod | null;
    totalUsd: number;
    paidAmount: number;
    completedAt: string;
  }>;
  recentTransfers: Array<{
    id: string;
    transferNumber: string;
    status: TransferStatus;
    createdAt: string;
    storeName: string;
  }>;
  todayExpenses: {
    summary: {
      count: number;
      amountUsd: number;
      drawerUsd: number;
      pendingCashier: number;
    };
    items: Array<{
      id: string;
      reference: string;
      status: ExpenseStatus;
      category: ExpenseCategoryCode;
      amount: number;
      currency: "USD" | "CDF";
      amountUsdEquivalent: number;
      spentAt: string;
      locationName: string;
      fromCashDrawer: boolean;
      createdByName: string;
    }>;
  };
};

export function fetchAdminDashboard(): Promise<AdminDashboardPayload> {
  return apiRequest("/dashboard");
}