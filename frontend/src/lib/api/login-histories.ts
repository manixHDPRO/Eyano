import { apiRequest } from "./client";
import type { LoginHistoriesSummary, PaginatedLoginHistories } from "./types";

export type ListLoginHistoriesParams = {
  page?: number;
  pageSize?: number;
  userId?: string;
  success?: boolean;
  search?: string;
  from?: string;
  to?: string;
  userScope?: "all" | "known" | "unknown";
};

export function fetchLoginHistories(params: ListLoginHistoriesParams = {}): Promise<PaginatedLoginHistories> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.userId) query.set("userId", params.userId);
  if (params.success === true) query.set("success", "true");
  if (params.success === false) query.set("success", "false");
  if (params.search) query.set("search", params.search);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.userScope && params.userScope !== "all") query.set("userScope", params.userScope);
  const suffix = query.toString();
  return apiRequest(`/login-histories${suffix ? `?${suffix}` : ""}`);
}

export function fetchLoginHistoriesSummary(): Promise<LoginHistoriesSummary> {
  return apiRequest("/login-histories/summary");
}