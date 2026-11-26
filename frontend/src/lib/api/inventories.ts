import { apiRequest } from "./client";
import type {
  InventoryDetail,
  InventoryLocationOption,
  InventoryScopeType,
  InventoryStatus,
  InventorySummary,
  PaginatedInventories,
} from "./types";

export type ListInventoriesParams = {
  page?: number;
  pageSize?: number;
  status?: InventoryStatus;
  scopeType?: InventoryScopeType;
  storeId?: string;
  warehouseId?: string;
  search?: string;
};

export function fetchInventories(params: ListInventoriesParams = {}): Promise<PaginatedInventories> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  if (params.scopeType) query.set("scopeType", params.scopeType);
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.search) query.set("search", params.search);
  const suffix = query.toString();
  return apiRequest(`/inventories${suffix ? `?${suffix}` : ""}`);
}

export function fetchInventorySummary(): Promise<InventorySummary> {
  return apiRequest("/inventories/summary");
}

export function fetchInventoryLocations(): Promise<{ items: InventoryLocationOption[] }> {
  return apiRequest("/inventories/locations");
}

export function fetchInventory(id: string): Promise<InventoryDetail> {
  return apiRequest(`/inventories/${id}`);
}

export function createInventory(payload: {
  scopeType: InventoryScopeType;
  warehouseId?: string;
  storeId?: string;
  note?: string;
}): Promise<InventoryDetail> {
  return apiRequest("/inventories", { method: "POST", body: JSON.stringify(payload) });
}

export function updateInventory(id: string, payload: { note?: string | null }): Promise<InventoryDetail> {
  return apiRequest(`/inventories/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function startInventory(id: string): Promise<InventoryDetail> {
  return apiRequest(`/inventories/${id}/start`, { method: "POST" });
}

export function patchInventoryItems(
  id: string,
  items: Array<{ productId: string; physicalQty: number; justification?: string | null }>,
): Promise<InventoryDetail> {
  return apiRequest(`/inventories/${id}/items`, { method: "PATCH", body: JSON.stringify({ items }) });
}

export function submitInventory(id: string): Promise<InventoryDetail> {
  return apiRequest(`/inventories/${id}/submit`, { method: "POST" });
}

export function validateInventory(id: string): Promise<InventoryDetail> {
  return apiRequest(`/inventories/${id}/validate`, { method: "POST" });
}

export function cancelInventory(id: string, reason?: string): Promise<InventoryDetail> {
  return apiRequest(`/inventories/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}