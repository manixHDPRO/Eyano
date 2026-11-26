import { apiRequest } from "./client";
import type {
  PaginatedStockLevels,
  PaginatedStockMovements,
  StockManualAdjustmentResult,
  StockReconcileResult,
  StockSummary,
} from "./types";

export type ListStockLevelsParams = {
  page?: number;
  pageSize?: number;
  warehouseId?: string;
  storeId?: string;
  productId?: string;
  search?: string;
  locationKind?: "WAREHOUSE" | "STORE" | "ALL";
  alertStatus?: "OK" | "LOW" | "STOCKOUT";
};

export type ListStockMovementsParams = {
  page?: number;
  pageSize?: number;
  warehouseId?: string;
  storeId?: string;
  productId?: string;
  movementType?: string;
  search?: string;
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function fetchStockSummary(): Promise<StockSummary> {
  return apiRequest("/stock/summary");
}

export function fetchStockLevels(params: ListStockLevelsParams = {}): Promise<PaginatedStockLevels> {
  return apiRequest(`/stock/levels${toQuery(params)}`);
}

export function fetchStockMovements(params: ListStockMovementsParams = {}): Promise<PaginatedStockMovements> {
  return apiRequest(`/stock/movements${toQuery(params)}`);
}

export type ManualAdjustmentPayload = {
  productId: string;
  warehouseId?: string;
  storeId?: string;
  direction: "IN" | "OUT";
  quantity: number;
  note: string;
};

export function postManualStockAdjustment(payload: ManualAdjustmentPayload): Promise<StockManualAdjustmentResult> {
  return apiRequest("/stock/manual-adjustments", { method: "POST", body: JSON.stringify(payload) });
}

export function reconcileStock(params: { warehouseId?: string; storeId?: string; productId?: string } = {}): Promise<StockReconcileResult> {
  return apiRequest(`/stock/reconcile${toQuery(params)}`, { method: "POST" });
}