import type { AppNotificationItem } from "../../lib/api/types";

export const NOTIFICATION_TYPE_OPTIONS = [
  { value: "", label: "Tous les types" },
  { value: "LOW_STOCK", label: "Stock faible" },
  { value: "STOCKOUT", label: "Rupture de stock" },
  { value: "TRANSFER_PENDING", label: "Transfert en attente" },
  { value: "TRANSFER_SHIPPED", label: "Transfert expédié" },
  { value: "TRANSFER_RECEIVED", label: "Transfert réceptionné" },
  { value: "INVENTORY_VARIANCE", label: "Écart inventaire" },
  { value: "CASH_VARIANCE", label: "Écart de caisse" },
  { value: "INTERNAL_ISSUE_PENDING", label: "Sortie interne" },
  { value: "EXPENSE_DRAWER_PENDING", label: "Dépense tiroir" },
  { value: "PRICE_CHANGED", label: "Changement de prix" },
  { value: "DISCOUNT_CHANGED", label: "Changement de remise" },
  { value: "RATE_CHANGED", label: "Taux de change" },
] as const;

export function notificationTypeLabel(type: string): string {
  const found = NOTIFICATION_TYPE_OPTIONS.find((row) => row.value === type);
  return found?.label ?? type;
}

export function notificationSeverityTitleClass(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "text-red-700";
    case "WARNING":
      return "text-amber-700";
    case "INFO":
      return "text-slate-900";
    default: {
      return "text-slate-900";
    }
  }
}

export function notificationSeverityDotClass(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500";
    case "WARNING":
      return "bg-amber-500";
    case "INFO":
      return "bg-slate-400";
    default: {
      return "bg-slate-400";
    }
  }
}

export function notificationActionHref(item: AppNotificationItem): string | null {
  switch (item.type) {
    case "LOW_STOCK":
    case "STOCKOUT":
      return "/admin/stock";
    case "TRANSFER_PENDING":
    case "TRANSFER_RECEIVED":
      return item.entityId ? `/admin/transfers/${item.entityId}` : "/admin/transfers";
    case "TRANSFER_SHIPPED":
      return "/pos/receive-transfers?status=SHIPPED";
    case "INVENTORY_VARIANCE":
      return item.entityId ? `/admin/inventories/${item.entityId}` : "/admin/inventories";
    case "CASH_VARIANCE":
      return item.entityId ? `/admin/cash-sessions/${item.entityId}` : "/admin/cash-sessions";
    case "INTERNAL_ISSUE_PENDING":
      return "/pos/confirm-internal-issues";
    case "EXPENSE_DRAWER_PENDING":
      return "/pos/confirm-expenses";
    case "PRICE_CHANGED":
    case "DISCOUNT_CHANGED":
      return "/admin/pricing";
    case "RATE_CHANGED":
      return "/admin/exchange-rates";
    default:
      return null;
  }
}