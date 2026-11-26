import type { PermissionCatalogItem } from "../../lib/api/types";

export const PROTECTED_PERMISSION_CODE = "roles.manage";

export function groupPermissionsByModule(items: PermissionCatalogItem[]): Map<string, PermissionCatalogItem[]> {
  const map = new Map<string, PermissionCatalogItem[]>();
  for (const item of items) {
    const bucket = map.get(item.module) ?? [];
    bucket.push(item);
    map.set(item.module, bucket);
  }
  return map;
}