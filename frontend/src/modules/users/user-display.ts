import type { RoleSummary, UserListItem } from "../../lib/api/types";

export function userFullName(user: Pick<UserListItem, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function userInitials(user: Pick<UserListItem, "firstName" | "lastName">): string {
  const first = user.firstName.trim().charAt(0);
  const last = user.lastName.trim().charAt(0);
  const merged = `${first}${last}`.toUpperCase();
  return merged || "?";
}

export function userStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Actif";
    case "INACTIVE":
      return "Désactivé";
    case "LOCKED":
      return "Verrouillé";
    default:
      return status;
  }
}

export function userStatusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "ACTIVE") {
    return "success";
  }
  if (status === "LOCKED") {
    return "warning";
  }
  return "neutral";
}

const ROLE_ACCENT: Record<string, string> = {
  SUPER_ADMIN: "border-violet-200 bg-violet-50 text-violet-900",
  CENTRAL_ADMIN: "border-sky-200 bg-sky-50 text-sky-900",
  ADMIN_STAFF: "border-slate-200 bg-slate-100 text-slate-800",
  WAREHOUSE_MANAGER: "border-amber-200 bg-amber-50 text-amber-900",
  STORE_MANAGER: "border-emerald-200 bg-emerald-50 text-emerald-900",
  CASHIER: "border-slate-200 bg-white text-slate-700",
};

export function roleChipClassName(code: string): string {
  return ROLE_ACCENT[code] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

export function permissionModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    users: "Utilisateurs",
    roles: "Rôles & droits",
    stores: "Boutiques",
    products: "Catalogue",
    pricing: "Tarification",
    discounts: "Remises",
    barcodes: "Codes-barres",
    suppliers: "Fournisseurs",
    stock: "Stock",
    transfers: "Transferts",
    inventory: "Inventaires",
    "internal-issues": "Sorties internes",
    sales: "Ventes",
    cash: "Caisse",
    expenses: "Dépenses",
    finance: "Finance",
    reports: "Rapports",
    settings: "Paramètres",
    audit: "Audit",
  };
  return labels[module] ?? module;
}

export function sortRolesForDisplay(roles: RoleSummary[]): RoleSummary[] {
  return [...roles].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}