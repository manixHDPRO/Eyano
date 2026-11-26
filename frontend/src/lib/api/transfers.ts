import { apiRequest } from "./client";
import type {
  PaginatedTransfers,
  TransferCatalogItem,
  TransferDestination,
  TransferDetail,
  TransferSummary,
} from "./types";

export type ListTransfersParams = {
  page?: number;
  pageSize?: number;
  status?: string;
  storeId?: string;
  warehouseId?: string;
  search?: string;
};

export function fetchTransfers(params: ListTransfersParams = {}): Promise<PaginatedTransfers> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.search) query.set("search", params.search);
  const suffix = query.toString();
  return apiRequest(`/transfers${suffix ? `?${suffix}` : ""}`);
}

export function fetchTransferSummary(): Promise<TransferSummary> {
  return apiRequest("/transfers/summary");
}

export function fetchTransferDestinations(): Promise<{ items: TransferDestination[] }> {
  return apiRequest("/transfers/destinations");
}

export function fetchTransferCatalog(params: {
  storeId: string;
  warehouseId: string;
  search?: string;
  pageSize?: number;
}): Promise<{ items: TransferCatalogItem[]; total?: number; truncated?: boolean }> {
  const query = new URLSearchParams();
  query.set("storeId", params.storeId);
  query.set("warehouseId", params.warehouseId);
  if (params.search) query.set("search", params.search);
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  return apiRequest(`/transfers/catalog?${query.toString()}`);
}

export function fetchTransfer(id: string): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}`);
}

export type TransferLinePayload = {
  productId: string;
  quantityRequested: number;
};

export type CreateTransferPayload = {
  warehouseId: string;
  storeId: string;
  note?: string;
  items?: TransferLinePayload[];
  submitImmediately?: boolean;
};

export function createTransfer(payload: CreateTransferPayload): Promise<TransferDetail> {
  return apiRequest("/transfers", { method: "POST", body: JSON.stringify(payload) });
}

export function updateTransfer(
  id: string,
  payload: Partial<Pick<CreateTransferPayload, "warehouseId" | "storeId" | "note">>,
): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function setTransferItems(id: string, items: TransferLinePayload[]): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}/items`, { method: "PUT", body: JSON.stringify({ items }) });
}

export function submitTransfer(id: string): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}/submit`, { method: "POST" });
}

export function validateTransfer(id: string): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}/validate`, { method: "POST" });
}

export function prepareTransfer(id: string): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}/prepare`, { method: "POST" });
}

export function shipTransfer(
  id: string,
  items?: Array<{ productId: string; quantityShipped: number }>,
): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}/ship`, { method: "POST", body: JSON.stringify({ items }) });
}

export function receiveTransfer(
  id: string,
  payload: {
    items: Array<{ transferItemId?: string; productId?: string; quantityReceived: number }>;
    complete?: boolean;
  },
): Promise<TransferDetail & { hasVariance?: boolean }> {
  return apiRequest(`/transfers/${id}/receive`, { method: "POST", body: JSON.stringify(payload) });
}

export function cancelTransfer(id: string, reason?: string): Promise<TransferDetail> {
  return apiRequest(`/transfers/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}
