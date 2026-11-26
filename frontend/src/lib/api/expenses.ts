import { apiRequest } from "./client";
import type {
  ExpenseCategoryCode,
  ExpenseDetail,
  ExpenseLocationOption,
  ExpenseListItem,
  ExpensesSummary,
  ExpenseScopeType,
  ExpenseStatus,
  PaginatedExpenses,
} from "./types";

export type ListExpensesParams = {
  page?: number;
  pageSize?: number;
  scopeType?: ExpenseScopeType;
  storeId?: string;
  warehouseId?: string;
  currency?: "USD" | "CDF";
  category?: ExpenseCategoryCode;
  search?: string;
  spentFrom?: string;
  spentTo?: string;
  fromCashDrawer?: boolean;
  status?: ExpenseStatus;
};

export function fetchExpenseCategories(): Promise<{
  items: Array<{ code: ExpenseCategoryCode; label: string }>;
}> {
  return apiRequest("/expenses/categories");
}

export function fetchExpenseLocations(): Promise<{ items: ExpenseLocationOption[] }> {
  return apiRequest("/expenses/locations");
}

export function fetchExpensesSummary(storeId?: string): Promise<ExpensesSummary> {
  const query = new URLSearchParams();
  if (storeId) {
    query.set("storeId", storeId);
  }
  const suffix = query.toString();
  return apiRequest(`/expenses/summary${suffix ? `?${suffix}` : ""}`);
}

export function fetchExpenses(params: ListExpensesParams = {}): Promise<PaginatedExpenses> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.scopeType) query.set("scopeType", params.scopeType);
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.currency) query.set("currency", params.currency);
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.spentFrom) query.set("spentFrom", params.spentFrom);
  if (params.spentTo) query.set("spentTo", params.spentTo);
  if (params.fromCashDrawer === true) query.set("fromCashDrawer", "true");
  if (params.fromCashDrawer === false) query.set("fromCashDrawer", "false");
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return apiRequest(`/expenses${suffix ? `?${suffix}` : ""}`);
}

export function fetchExpense(id: string): Promise<ExpenseDetail> {
  return apiRequest(`/expenses/${id}`);
}

export function createExpense(payload: {
  scopeType: ExpenseScopeType;
  warehouseId?: string;
  storeId?: string;
  category: ExpenseCategoryCode;
  amount: number;
  currency: "USD" | "CDF";
  spentAt?: string;
  description?: string;
  fromCashDrawer?: boolean;
  cashSessionId?: string;
  cashRegisterId?: string;
}): Promise<ExpenseDetail> {
  return apiRequest("/expenses", { method: "POST", body: JSON.stringify(payload) });
}

export function fetchPendingCashierExpenses(payload: {
  storeId: string;
  cashRegisterId?: string;
}): Promise<{ items: ExpenseListItem[] }> {
  const query = new URLSearchParams({ storeId: payload.storeId });
  if (payload.cashRegisterId) {
    query.set("cashRegisterId", payload.cashRegisterId);
  }
  return apiRequest(`/expenses/pending-cashier-confirmation?${query.toString()}`);
}

export function confirmCashierExpense(id: string): Promise<ExpenseDetail> {
  return apiRequest(`/expenses/${id}/confirm-cashier`, { method: "POST" });
}

export function uploadExpenseReceipt(expenseId: string, file: File): Promise<ExpenseDetail> {
  const body = new FormData();
  body.set("file", file);
  return apiRequest(`/expenses/${expenseId}/receipt`, { method: "POST", body });
}

export function expenseLocationKey(option: ExpenseLocationOption): string {
  if (option.scopeType === "WAREHOUSE") {
    return `w:${option.warehouse.id}`;
  }
  return `s:${option.store.id}`;
}

export function expenseSiteLabel(item: ExpenseListItem): string {
  if (item.store) {
    return item.store.city ? `${item.store.name} — ${item.store.city}` : item.store.name;
  }
  if (item.warehouse) {
    return `Entrepôt — ${item.warehouse.name}`;
  }
  return "—";
}