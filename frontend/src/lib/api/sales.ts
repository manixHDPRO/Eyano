import { apiRequest } from "./client";
import type { PaginatedSales, SaleDetail, SalesSummary } from "./types";

export type CreateSalePaymentPayload = {
  method: "CASH" | "MPESA" | "ORANGE_MONEY" | "AIRTEL_MONEY";
  currency: "USD" | "CDF";
  amount: number;
  providerReference?: string;
};

export type CreateSalePayload = {
  cashSessionId: string;
  items: { productId: string; quantity: number }[];
  payments: CreateSalePaymentPayload[];
};

export function createSale(idempotencyKey: string, payload: CreateSalePayload): Promise<SaleDetail> {
  return apiRequest("/sales", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export function fetchSale(saleId: string): Promise<SaleDetail> {
  return apiRequest(`/sales/${saleId}`);
}

export type ListSalesParams = {
  page?: number;
  pageSize?: number;
  status?: "COMPLETED" | "VOIDED" | "";
  storeId?: string;
  cashSessionId?: string;
  search?: string;
  completedFrom?: string;
  completedTo?: string;
};

export function fetchSales(params: ListSalesParams = {}): Promise<PaginatedSales> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.cashSessionId) query.set("cashSessionId", params.cashSessionId);
  if (params.completedFrom) query.set("completedFrom", params.completedFrom);
  if (params.completedTo) query.set("completedTo", params.completedTo);
  if (params.search?.trim()) query.set("search", params.search.trim());
  const suffix = query.toString();
  return apiRequest(`/sales${suffix ? `?${suffix}` : ""}`);
}

export function fetchSalesSummary(): Promise<SalesSummary> {
  return apiRequest("/sales/summary");
}

export function voidSale(saleId: string, reason: string): Promise<SaleDetail> {
  return apiRequest(`/sales/${saleId}/void`, { method: "POST", body: JSON.stringify({ reason }) });
}