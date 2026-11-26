import { apiRequest } from "./client";
import type { PaginatedPayments, PaymentsSummary } from "./types";

export type ListPaymentsParams = {
  page?: number;
  pageSize?: number;
  storeId?: string;
  method?: "CASH" | "MPESA" | "ORANGE_MONEY" | "AIRTEL_MONEY";
  currency?: "USD" | "CDF";
  saleStatus?: "COMPLETED" | "VOIDED" | "ALL";
  search?: string;
  paidFrom?: string;
  paidTo?: string;
};

export function fetchPayments(params: ListPaymentsParams = {}): Promise<PaginatedPayments> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.method) query.set("method", params.method);
  if (params.currency) query.set("currency", params.currency);
  if (params.saleStatus) query.set("saleStatus", params.saleStatus);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.paidFrom) query.set("paidFrom", params.paidFrom);
  if (params.paidTo) query.set("paidTo", params.paidTo);
  const suffix = query.toString();
  return apiRequest(`/payments${suffix ? `?${suffix}` : ""}`);
}

export function fetchPaymentsSummary(storeId?: string): Promise<PaymentsSummary> {
  const suffix = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  return apiRequest(`/payments/summary${suffix}`);
}