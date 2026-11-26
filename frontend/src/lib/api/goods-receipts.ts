import { apiRequest } from "./client";
import type { GoodsReceiptDetail, GoodsReceiptValidateResult, PaginatedGoodsReceipts } from "./types";

export type ListGoodsReceiptsParams = {
  page?: number;
  pageSize?: number;
  status?: string;
  supplierId?: string;
  warehouseId?: string;
  search?: string;
};

export function fetchGoodsReceipts(params: ListGoodsReceiptsParams = {}): Promise<PaginatedGoodsReceipts> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  if (params.supplierId) query.set("supplierId", params.supplierId);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.search) query.set("search", params.search);
  const suffix = query.toString();
  return apiRequest(`/goods-receipts${suffix ? `?${suffix}` : ""}`);
}

export function fetchGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  return apiRequest(`/goods-receipts/${id}`);
}

export type GoodsReceiptLinePayload = {
  productId: string;
  quantity: number;
  unitCost: number;
  note?: string;
};

export type CreateGoodsReceiptPayload = {
  supplierId: string;
  warehouseId: string;
  note?: string;
  items?: GoodsReceiptLinePayload[];
};

export function createGoodsReceipt(payload: CreateGoodsReceiptPayload): Promise<GoodsReceiptDetail> {
  return apiRequest("/goods-receipts", { method: "POST", body: JSON.stringify(payload) });
}

export function updateGoodsReceipt(
  id: string,
  payload: Partial<Pick<CreateGoodsReceiptPayload, "supplierId" | "warehouseId" | "note">>,
): Promise<GoodsReceiptDetail> {
  return apiRequest(`/goods-receipts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function setGoodsReceiptItems(id: string, items: GoodsReceiptLinePayload[]): Promise<GoodsReceiptDetail> {
  return apiRequest(`/goods-receipts/${id}/items`, { method: "PUT", body: JSON.stringify({ items }) });
}

export function validateGoodsReceipt(id: string): Promise<GoodsReceiptValidateResult> {
  return apiRequest(`/goods-receipts/${id}/validate`, { method: "POST" });
}

export function cancelGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  return apiRequest(`/goods-receipts/${id}/cancel`, { method: "POST" });
}