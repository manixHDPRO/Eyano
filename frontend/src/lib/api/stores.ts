import { apiRequest } from "./client";
import type { PaginatedStores, StoreDetail, StoreOption } from "./types";

export function fetchStoresForAssignment(): Promise<{ items: StoreOption[] }> {
  return apiRequest("/stores/options");
}

export type ListStoresParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

export function fetchStores(params: ListStoresParams = {}): Promise<PaginatedStores> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return apiRequest(`/stores${suffix ? `?${suffix}` : ""}`);
}

export function fetchStore(id: string): Promise<StoreDetail> {
  return apiRequest(`/stores/${id}`);
}

export type StorePayload = {
  code?: string;
  name?: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  status?: string;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
};

export function createStore(payload: StorePayload): Promise<StoreDetail> {
  return apiRequest("/stores", { method: "POST", body: JSON.stringify(payload) });
}

export function updateStore(id: string, payload: StorePayload): Promise<StoreDetail> {
  return apiRequest(`/stores/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export type StoreDeleteSummary = {
  id: string;
  code: string;
  name: string;
};

export type BulkDeleteStoresResult = {
  deleted: StoreDeleteSummary[];
  skipped: Array<StoreDeleteSummary & { reason: string }>;
};

export function deleteStore(id: string): Promise<void> {
  return apiRequest(`/stores/${id}`, { method: "DELETE", parseJson: false });
}

export function deleteStores(ids: string[]): Promise<BulkDeleteStoresResult> {
  return apiRequest("/stores/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
}
