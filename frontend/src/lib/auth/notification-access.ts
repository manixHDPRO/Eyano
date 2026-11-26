import type { AuthUser } from "../api/types";
import { hasAnyPermission } from "../navigation/admin-access";

/** Aligné sur `NOTIFICATION_READ_PERMISSIONS` (backend notifications.controller). */
export const NOTIFICATION_READ_PERMISSIONS = [
  "transfers.receive",
  "stock.read",
  "reports.read",
  "transfers.create",
  "transfers.validate",
] as const;

export function canReadAppNotifications(user: AuthUser | null | undefined): boolean {
  return hasAnyPermission(user, NOTIFICATION_READ_PERMISSIONS);
}