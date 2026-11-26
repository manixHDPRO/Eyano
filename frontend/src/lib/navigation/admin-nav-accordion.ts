import type { AdminNavGroup, AdminNavItem } from "./admin-nav";
import { findNavItemByPath, isAdministrationSectionPath } from "./admin-nav";

const STORAGE_KEY = "eyano.admin.nav.open-group";

export function groupContainsPath(group: AdminNavGroup, pathname: string): boolean {
  if (group.id === "system") {
    return pathname === "/admin/administration" || isAdministrationSectionPath(pathname);
  }
  if (group.id === "reports-exports") {
    return pathname === "/admin/reports" || pathname.startsWith("/admin/reports/");
  }
  const active = findNavItemByPath(pathname);
  if (!active) {
    return false;
  }
  return group.items.some((item) => item.id === active.id);
}

export function findOpenGroupIdForPath(groups: AdminNavGroup[], pathname: string): string | null {
  const active = groups.find((group) => group.items.length > 1 && groupContainsPath(group, pathname));
  return active?.id ?? null;
}

export function loadOpenGroupId(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) {
      return null;
    }
    if (value === "none") {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function saveOpenGroupId(groupId: string | null): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, groupId ?? "none");
  } catch {
    /* ignore */
  }
}

export function isItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.id === "administration") {
    return pathname === "/admin/administration" || isAdministrationSectionPath(pathname);
  }
  if (item.end) {
    return pathname === item.to;
  }
  if (item.implemented) {
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }
  return pathname === item.to;
}