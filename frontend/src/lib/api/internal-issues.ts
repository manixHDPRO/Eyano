import { apiRequest } from "./client";
import type {
  InternalIssueCatalogItem,
  InternalIssueDetail,
  InternalIssueListItem,
  InternalIssueLocationOption,
  InternalIssueReason,
  InternalIssueScopeType,
  InternalIssueStatus,
  InternalIssueSummary,
  PaginatedInternalIssues,
} from "./types";

export type ListInternalIssuesParams = {
  page?: number;
  pageSize?: number;
  status?: InternalIssueStatus;
  scopeType?: InternalIssueScopeType;
  storeId?: string;
  warehouseId?: string;
  reasonCode?: InternalIssueReason;
  search?: string;
};

export function fetchInternalIssueSummary(): Promise<InternalIssueSummary> {
  return apiRequest("/internal-issues/summary");
}

export function fetchInternalIssueLocations(): Promise<{ items: InternalIssueLocationOption[] }> {
  return apiRequest("/internal-issues/locations");
}

export function fetchInternalIssues(params: ListInternalIssuesParams = {}): Promise<PaginatedInternalIssues> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  if (params.scopeType) query.set("scopeType", params.scopeType);
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.reasonCode) query.set("reasonCode", params.reasonCode);
  if (params.search) query.set("search", params.search);
  const suffix = query.toString();
  return apiRequest(`/internal-issues${suffix ? `?${suffix}` : ""}`);
}

export function fetchInternalIssue(id: string): Promise<InternalIssueDetail> {
  return apiRequest(`/internal-issues/${id}`);
}

export function fetchInternalIssueCatalog(payload: {
  scopeType: InternalIssueScopeType;
  warehouseId?: string;
  storeId?: string;
  search?: string;
  pageSize?: number;
}): Promise<{ items: InternalIssueCatalogItem[] }> {
  const query = new URLSearchParams();
  query.set("scopeType", payload.scopeType);
  if (payload.warehouseId) query.set("warehouseId", payload.warehouseId);
  if (payload.storeId) query.set("storeId", payload.storeId);
  const search = payload.search?.trim();
  if (search && search.length >= 2) {
    query.set("search", search);
  }
  if (payload.pageSize) query.set("pageSize", String(payload.pageSize));
  return apiRequest(`/internal-issues/catalog?${query.toString()}`);
}

export function createInternalIssue(payload: {
  scopeType: InternalIssueScopeType;
  warehouseId?: string;
  storeId?: string;
  productId: string;
  quantity: number;
  reasonCode: InternalIssueReason;
  reasonText?: string;
}): Promise<InternalIssueDetail> {
  return apiRequest("/internal-issues", { method: "POST", body: JSON.stringify(payload) });
}

export function updateInternalIssue(
  id: string,
  payload: { quantity?: number; reasonCode?: InternalIssueReason; reasonText?: string | null },
): Promise<InternalIssueDetail> {
  return apiRequest(`/internal-issues/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function submitInternalIssue(id: string): Promise<InternalIssueDetail> {
  return apiRequest(`/internal-issues/${id}/submit`, { method: "POST" });
}

export function approveInternalIssue(id: string, reviewNote?: string): Promise<InternalIssueDetail> {
  return apiRequest(`/internal-issues/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewNote: reviewNote?.trim() || undefined }),
  });
}

export function rejectInternalIssue(id: string, reviewNote: string): Promise<InternalIssueDetail> {
  return apiRequest(`/internal-issues/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

export function cancelInternalIssue(id: string, reason?: string): Promise<InternalIssueDetail> {
  return apiRequest(`/internal-issues/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason?.trim() || undefined }),
  });
}

export function fetchPendingStoreInternalIssues(storeId: string): Promise<{ items: InternalIssueListItem[] }> {
  const query = new URLSearchParams({ storeId });
  return apiRequest(`/internal-issues/pending-store-confirmation?${query.toString()}`);
}

export function confirmStoreInternalIssue(id: string): Promise<InternalIssueDetail> {
  return apiRequest(`/internal-issues/${id}/confirm-store`, { method: "POST" });
}