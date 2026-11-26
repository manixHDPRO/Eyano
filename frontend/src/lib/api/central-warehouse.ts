import { apiRequest } from "./client";

export type CentralWarehouseDashboard = {
  warehouse: { id: string; code: string; name: string };
  totalUnits: number;
  totalValuationUsd: number;
  lowStockCount: number;
  stockRows: Array<{
    productId: string;
    reference: string;
    name: string;
    purchasePriceUsd: number;
    alertThreshold: number;
    quantity: number;
    valuationUsd: number;
    isLowStock: boolean;
    isStockout: boolean;
  }>;
};

export function fetchCentralWarehouseDashboard(): Promise<CentralWarehouseDashboard> {
  return apiRequest("/warehouses/central/dashboard");
}

export type CentralWarehouseReceivePayload = {
  productId: string;
  supplierId: string;
  quantity: number;
  notes?: string;
};

export function postCentralWarehouseReceive(payload: CentralWarehouseReceivePayload) {
  return apiRequest("/warehouses/central/receive", { method: "POST", body: JSON.stringify(payload) });
}

export type CentralWarehouseAdjustPayload = {
  productId: string;
  newQuantity: number;
  notes: string;
};

export function postCentralWarehouseAdjust(payload: CentralWarehouseAdjustPayload) {
  return apiRequest("/warehouses/central/adjust", { method: "POST", body: JSON.stringify(payload) });
}