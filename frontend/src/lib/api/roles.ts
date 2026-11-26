import { apiRequest } from "./client";
import type { RoleDetail, RoleSummary } from "./types";

export function fetchRoles(): Promise<{ items: RoleSummary[] }> {
  return apiRequest("/roles");
}

export function fetchRole(id: string): Promise<RoleDetail> {
  return apiRequest(`/roles/${id}`);
}

export function setRolePermissions(roleId: string, permissionIds: string[]): Promise<RoleDetail> {
  return apiRequest(`/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: JSON.stringify({ permissionIds }),
  });
}