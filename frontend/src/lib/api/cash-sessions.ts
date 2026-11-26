import { apiRequest } from "./client";
import type { CashSessionDetail, PaginatedCashSessions } from "./types";

export function fetchCurrentCashSession(cashRegisterId: string): Promise<CashSessionDetail | null> {
  const query = new URLSearchParams({ cashRegisterId });
  return apiRequest(`/cash-sessions/current?${query.toString()}`);
}

export function fetchCashSession(sessionId: string): Promise<CashSessionDetail> {
  return apiRequest(`/cash-sessions/${sessionId}`);
}

export function fetchCashSessions(params: {
  page?: number;
  pageSize?: number;
  status?: "OPEN" | "CLOSED" | "";
  storeId?: string;
} = {}): Promise<PaginatedCashSessions> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  if (params.storeId) query.set("storeId", params.storeId);
  const suffix = query.toString();
  return apiRequest(`/cash-sessions${suffix ? `?${suffix}` : ""}`);
}

export function openCashSession(payload: {
  cashRegisterId: string;
  openingFloatUsd: number;
  openingFloatCdf: number;
}): Promise<CashSessionDetail> {
  return apiRequest("/cash-sessions/open", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function closeCashSession(
  sessionId: string,
  payload: { countedUsd: number; countedCdf: number; note?: string },
): Promise<CashSessionDetail> {
  return apiRequest(`/cash-sessions/${sessionId}/close`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}