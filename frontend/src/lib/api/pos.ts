import { apiRequest } from "./client";
import type { PosCatalog, PosDailySalesReport, PosWorkspace } from "./types";

export function fetchPosWorkspace(): Promise<PosWorkspace> {
  return apiRequest("/pos/workspace");
}

export function fetchPosCatalog(storeId: string, search?: string): Promise<PosCatalog> {
  const query = new URLSearchParams({ storeId });
  if (search?.trim()) {
    query.set("search", search.trim());
  }
  return apiRequest(`/pos/catalog?${query.toString()}`);
}

export function fetchPosDailySalesReport(params: {
  storeId: string;
  cashRegisterId: string;
  date?: string;
}): Promise<PosDailySalesReport> {
  const query = new URLSearchParams({
    storeId: params.storeId,
    cashRegisterId: params.cashRegisterId,
  });
  if (params.date?.trim()) {
    query.set("date", params.date.trim());
  }
  return apiRequest(`/pos/daily-sales-report?${query.toString()}`);
}