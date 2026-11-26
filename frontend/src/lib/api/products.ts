import { apiRequest } from "./client";
import type { PaginatedProducts, ProductDetail, ProductStoreAuthorizationList } from "./types";

export type ListProductsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  categoryId?: string;
};

export function fetchProducts(params: ListProductsParams = {}): Promise<PaginatedProducts> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  const suffix = query.toString();
  return apiRequest(`/products${suffix ? `?${suffix}` : ""}`);
}

export function fetchProduct(id: string): Promise<ProductDetail> {
  return apiRequest(`/products/${id}`);
}

export type ProductPayload = {
  reference?: string;
  name?: string;
  categoryId?: string;
  brand?: string | null;
  originCountry?: string | null;
  description?: string | null;
  purchasePrice?: number;
  officialPrice?: number;
  discountPercent?: number;
  alertThreshold?: number | null;
  status?: string;
};

export function createProduct(payload: ProductPayload): Promise<ProductDetail> {
  return apiRequest("/products", { method: "POST", body: JSON.stringify(payload) });
}

export function updateProduct(id: string, payload: ProductPayload): Promise<ProductDetail> {
  return apiRequest(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function uploadProductPhoto(id: string, file: File): Promise<ProductDetail> {
  const body = new FormData();
  body.append("file", file);
  return apiRequest(`/products/${id}/photo`, { method: "POST", body });
}

export function deleteProductPhoto(id: string): Promise<ProductDetail> {
  return apiRequest(`/products/${id}/photo`, { method: "DELETE" });
}

export function deleteProduct(id: string): Promise<{ id: string; reference: string; name: string }> {
  return apiRequest(`/products/${id}`, { method: "DELETE" });
}

export function fetchProductStores(id: string): Promise<ProductStoreAuthorizationList> {
  return apiRequest(`/products/${id}/stores`);
}

export function setProductStores(id: string, storeIds: string[]): Promise<ProductStoreAuthorizationList> {
  return apiRequest(`/products/${id}/stores`, { method: "PUT", body: JSON.stringify({ storeIds }) });
}
