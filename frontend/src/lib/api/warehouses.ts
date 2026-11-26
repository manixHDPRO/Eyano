import { apiRequest } from "./client";
import type { WarehouseDetail } from "./types";

export function fetchWarehouses(): Promise<{ items: WarehouseDetail[] }> {
  return apiRequest("/warehouses");
}

export type UpdateWarehousePayload = {
  name?: string;
  address?: string | null;
  status?: string;
};

export function updateWarehouse(id: string, payload: UpdateWarehousePayload): Promise<WarehouseDetail> {
  return apiRequest(`/warehouses/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
