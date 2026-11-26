import { apiRequest } from "./client";
import type { AuditDomain, AuditLogsCatalog, AuditLogsSummary, PaginatedAuditLogs } from "./types";

export type ListAuditLogsParams = {
  page?: number;
  pageSize?: number;
  storeId?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  domain?: AuditDomain;
  search?: string;
  from?: string;
  to?: string;
  sensitiveOnly?: boolean;
};

export function fetchAuditLogs(params: ListAuditLogsParams = {}): Promise<PaginatedAuditLogs> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.actorId) query.set("actorId", params.actorId);
  if (params.action) query.set("action", params.action);
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.domain) query.set("domain", params.domain);
  if (params.search) query.set("search", params.search);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.sensitiveOnly) query.set("sensitiveOnly", "true");
  const suffix = query.toString();
  return apiRequest(`/audit-logs${suffix ? `?${suffix}` : ""}`);
}

export function fetchAuditLogsSummary(storeId?: string): Promise<AuditLogsSummary> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  return apiRequest(`/audit-logs/summary${query}`);
}

export function fetchAuditLogsCatalog(): Promise<AuditLogsCatalog> {
  return apiRequest("/audit-logs/catalog");
}
