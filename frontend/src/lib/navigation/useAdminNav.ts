import { useMemo } from "react";
import type { AuthUser } from "../api/types";
import { hasPermission } from "../auth/permissions";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_SETTINGS_SECTIONS,
  type AdminNavGroup,
  type AdminNavItem,
  type AdminSettingsSection,
} from "./admin-nav";

function itemVisibleForUser(user: AuthUser, item: AdminNavItem): boolean {
  if (item.permissions.length === 0) {
    return true;
  }
  return item.permissions.some((code) => hasPermission(user, code));
}

export function filterAdminNavForUser(user: AuthUser | null | undefined): AdminNavGroup[] {
  if (!user) {
    return [];
  }
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemVisibleForUser(user, item)),
  })).filter((group) => group.items.length > 0);
}

export function filterAdminSettingsForUser(user: AuthUser | null | undefined): AdminSettingsSection[] {
  if (!user) {
    return [];
  }
  return ADMIN_SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => itemVisibleForUser(user, item)),
  })).filter((section) => section.items.length > 0);
}

export function useAdminNav(user: AuthUser | null | undefined): AdminNavGroup[] {
  return useMemo(() => filterAdminNavForUser(user), [user]);
}

export function useAdminSettingsNav(user: AuthUser | null | undefined): AdminSettingsSection[] {
  return useMemo(() => filterAdminSettingsForUser(user), [user]);
}