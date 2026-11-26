import { apiRequest } from "./client";
import type { CashRegisterDetail } from "./types";

export type ListCashRegistersParams = {
  page?: number;
  pageSize?: number;
  storeId?: string;
  status?: string;
};

export type PaginatedCashRegisters = {
  items: CashRegisterDetail[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function fetchCashRegisters(params: ListCashRegistersParams = {}): Promise<PaginatedCashRegisters> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return apiRequest(`/cash-registers${suffix ? `?${suffix}` : ""}`);
}

export type CreateCashRegisterPayload = {
  storeId: string;
  code: string;
  name: string;
  isDefault?: boolean;
};

export function createCashRegister(payload: CreateCashRegisterPayload): Promise<CashRegisterDetail> {
  return apiRequest("/cash-registers", { method: "POST", body: JSON.stringify(payload) });
}

export type UpdateCashRegisterPayload = {
  code?: string;
  name?: string;
  isDefault?: boolean;
  status?: string;
};

export function updateCashRegister(id: string, payload: UpdateCashRegisterPayload): Promise<CashRegisterDetail> {
  return apiRequest(`/cash-registers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
