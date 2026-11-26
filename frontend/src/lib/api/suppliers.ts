import { apiRequest } from "./client";
import type { PaginatedSuppliers, SupplierDetail, SupplierOption } from "./types";

export type ListSuppliersParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

export function fetchSuppliers(params: ListSuppliersParams = {}): Promise<PaginatedSuppliers> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return apiRequest(`/suppliers${suffix ? `?${suffix}` : ""}`);
}

export function fetchSupplierOptions(): Promise<{ items: SupplierOption[] }> {
  return apiRequest("/suppliers/options");
}

export function fetchSupplier(id: string): Promise<SupplierDetail> {
  return apiRequest(`/suppliers/${id}`);
}

export type SupplierPayload = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  country?: string | null;
  status?: string;
};

export function createSupplier(payload: SupplierPayload & { name: string }): Promise<SupplierDetail> {
  return apiRequest("/suppliers", { method: "POST", body: JSON.stringify(payload) });
}

export function updateSupplier(id: string, payload: SupplierPayload): Promise<SupplierDetail> {
  return apiRequest(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}