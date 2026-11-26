import { apiRequest } from "./client";
import type { PermissionCatalogItem } from "./types";

export function fetchPermissionsCatalog(): Promise<{ items: PermissionCatalogItem[] }> {
  return apiRequest("/permissions");
}