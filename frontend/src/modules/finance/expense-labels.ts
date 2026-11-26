import type { ExpenseCategoryCode } from "../../lib/api/types";

const CATEGORY_LABELS: Record<ExpenseCategoryCode, string> = {
  TRANSPORT: "Transport",
  DELIVERY: "Livraison",
  HANDLING: "Manutention",
  ELECTRICITY: "Électricité",
  MAINTENANCE: "Entretien",
  OTHER: "Autres charges",
};

export function expenseCategoryLabel(code: ExpenseCategoryCode): string {
  return CATEGORY_LABELS[code] ?? code;
}

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value: value as ExpenseCategoryCode,
  label,
}));