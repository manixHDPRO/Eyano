import type { AuthUser } from "../api/types";
import { hasPermission } from "../auth/permissions";

/** Rôles dont l’espace d’administration est fermé par défaut (preuve palier 6). */
const ADMIN_EXCLUDED_ROLES = new Set(["CASHIER"]);

export function canAccessAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (ADMIN_EXCLUDED_ROLES.has(user.role.code)) {
    return false;
  }
  return true;
}

export function hasAnyPermission(user: AuthUser | null | undefined, codes: readonly string[]): boolean {
  if (!user || codes.length === 0) {
    return false;
  }
  return codes.some((code) => hasPermission(user, code));
}