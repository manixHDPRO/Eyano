import { apiRequest } from "./client";
import type { AppNotificationItem } from "./types";

export type ListNotificationsParams = {
  storeId?: string;
  unreadOnly?: boolean;
  type?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedNotifications = {
  items: AppNotificationItem[];
  unreadCount: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function fetchNotifications(params: ListNotificationsParams = {}): Promise<PaginatedNotifications> {
  const query = new URLSearchParams();
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.unreadOnly) query.set("unreadOnly", "true");
  if (params.type) query.set("type", params.type);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.toString();
  return apiRequest(`/notifications${suffix ? `?${suffix}` : ""}`);
}

export function markAllNotificationsRead(storeId?: string): Promise<{ updated: number }> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  return apiRequest(`/notifications/read-all${query}`, { method: "PATCH" });
}

export function fetchNotificationUnreadCount(params: {
  storeId?: string;
  type?: string;
}): Promise<{ count: number }> {
  const query = new URLSearchParams();
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.type) query.set("type", params.type);
  return apiRequest(`/notifications/unread-count?${query.toString()}`);
}

export function markNotificationRead(id: string): Promise<AppNotificationItem> {
  return apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
}