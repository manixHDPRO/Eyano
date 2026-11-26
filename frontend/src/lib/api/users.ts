import { apiRequest } from "./client";
import type { PaginatedUsers, UserDetail } from "./types";

export type ListUsersParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  roleId?: string;
};

export function fetchUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.roleId) query.set("roleId", params.roleId);
  const suffix = query.toString();
  return apiRequest(`/users${suffix ? `?${suffix}` : ""}`);
}

export function fetchUser(id: string): Promise<UserDetail> {
  return apiRequest(`/users/${id}`);
}

export type CreateUserPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
};

export function createUser(payload: CreateUserPayload): Promise<UserDetail> {
  return apiRequest("/users", { method: "POST", body: JSON.stringify(payload) });
}

export type UpdateUserPayload = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  roleId?: string;
};

export function updateUser(id: string, payload: UpdateUserPayload): Promise<UserDetail> {
  return apiRequest(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deactivateUser(id: string): Promise<UserDetail> {
  return apiRequest(`/users/${id}/deactivate`, { method: "POST" });
}

export type UserStoreLink = { storeId: string; isPrimary?: boolean };

export function setUserStores(id: string, stores: UserStoreLink[]): Promise<UserDetail> {
  return apiRequest(`/users/${id}/stores`, { method: "PATCH", body: JSON.stringify({ stores }) });
}