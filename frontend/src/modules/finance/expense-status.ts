import type { ExpenseStatus } from "../../lib/api/types";

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  CONFIRMED: "Confirmée",
  PENDING_CASHIER_CONFIRMATION: "Attente caisse",
  CANCELLED: "Annulée",
};

export function expenseStatusLabel(status: ExpenseStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function expenseStatusTone(status: ExpenseStatus): "success" | "warning" | "neutral" {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "PENDING_CASHIER_CONFIRMATION":
      return "warning";
    case "CANCELLED":
      return "neutral";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}