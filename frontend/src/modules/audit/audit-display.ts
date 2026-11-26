import type { AuditDomain, AuditLogItem } from "../../lib/api/types";

export const AUDIT_DOMAIN_OPTIONS: { value: AuditDomain | ""; label: string }[] = [
  { value: "", label: "Tous les domaines" },
  { value: "identity", label: "Accès & identités" },
  { value: "network", label: "Réseau" },
  { value: "catalog", label: "Catalogue" },
  { value: "stock", label: "Stock" },
  { value: "sales", label: "Ventes & caisse" },
  { value: "finance", label: "Finance" },
  { value: "settings", label: "Paramètres" },
];

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Connexion",
  USER_CREATED: "Utilisateur créé",
  USER_UPDATED: "Utilisateur modifié",
  USER_DEACTIVATED: "Utilisateur désactivé",
  USER_STORES_UPDATED: "Boutiques utilisateur",
  ROLE_PERMISSIONS_UPDATED: "Permissions de rôle",
  STORE_CREATED: "Boutique créée",
  STORE_UPDATED: "Boutique modifiée",
  STORE_DELETED: "Boutique supprimée",
  WAREHOUSE_UPDATED: "Entrepôt modifié",
  CASH_REGISTER_CREATED: "Caisse créée",
  CASH_REGISTER_UPDATED: "Caisse modifiée",
  CATEGORY_CREATED: "Catégorie créée",
  CATEGORY_UPDATED: "Catégorie modifiée",
  CATEGORY_DELETED: "Catégorie supprimée",
  PRODUCT_CREATED: "Produit créé",
  PRODUCT_UPDATED: "Produit modifié",
  PRODUCT_PHOTO_UPDATED: "Photo produit",
  PRODUCT_DELETED: "Produit supprimé",
  PRODUCT_STORES_UPDATED: "Autorisations boutiques",
  PRODUCT_PRICE_UPDATED: "Prix modifié",
  PRODUCT_DISCOUNT_UPDATED: "Remise modifiée",
  BARCODE_GENERATED: "Code-barres généré",
  BARCODE_PRINTED: "Code-barres imprimé",
  SUPPLIER_CREATED: "Fournisseur créé",
  SUPPLIER_UPDATED: "Fournisseur modifié",
  GOODS_RECEIPT_CREATED: "Réception créée",
  GOODS_RECEIPT_UPDATED: "Réception modifiée",
  GOODS_RECEIPT_ITEMS_UPDATED: "Lignes de réception",
  GOODS_RECEIPT_VALIDATED: "Réception validée",
  GOODS_RECEIPT_CANCELLED: "Réception annulée",
  TRANSFER_CREATED: "Transfert créé",
  TRANSFER_UPDATED: "Transfert modifié",
  TRANSFER_ITEMS_UPDATED: "Lignes de transfert",
  TRANSFER_SUBMITTED: "Transfert soumis",
  TRANSFER_VALIDATED: "Transfert validé",
  TRANSFER_PREPARED: "Transfert préparé",
  TRANSFER_SHIPPED: "Transfert expédié",
  TRANSFER_RECEIVED: "Transfert réceptionné",
  TRANSFER_CANCELLED: "Transfert annulé",
  INVENTORY_CREATED: "Inventaire créé",
  INVENTORY_UPDATED: "Inventaire modifié",
  INVENTORY_STARTED: "Inventaire démarré",
  INVENTORY_ITEMS_UPDATED: "Comptages",
  INVENTORY_SUBMITTED: "Inventaire soumis",
  INVENTORY_VALIDATED: "Inventaire validé",
  INVENTORY_CANCELLED: "Inventaire annulé",
  INTERNAL_ISSUE_CREATED: "Sortie interne créée",
  INTERNAL_ISSUE_UPDATED: "Sortie interne modifiée",
  INTERNAL_ISSUE_SUBMITTED: "Sortie interne soumise",
  INTERNAL_ISSUE_STORE_CONFIRMED: "Sortie confirmée boutique",
  INTERNAL_ISSUE_APPROVED: "Sortie interne approuvée",
  INTERNAL_ISSUE_REJECTED: "Sortie interne rejetée",
  INTERNAL_ISSUE_CANCELLED: "Sortie interne annulée",
  "stock.manual_adjustment": "Ajustement manuel",
  "stock.reconcile": "Réconciliation stock",
  CASH_SESSION_OPENED: "Caisse ouverte",
  CASH_SESSION_CLOSED: "Caisse clôturée",
  SALE_COMPLETED: "Vente enregistrée",
  SALE_VOIDED: "Vente annulée",
  EXPENSE_CREATED: "Dépense enregistrée",
  EXPENSE_RECEIPT_UPDATED: "Justificatif dépense",
  EXPENSE_CASHIER_CONFIRMED: "Dépense confirmée",
  EXCHANGE_RATE_UPDATED: "Taux de change",
  SETTING_UPDATED: "Paramètre modifié",
};

const ENTITY_LABELS: Record<string, string> = {
  User: "Utilisateur",
  Role: "Rôle",
  Store: "Boutique",
  Warehouse: "Entrepôt",
  CashRegister: "Caisse",
  Category: "Catégorie",
  Product: "Produit",
  Barcode: "Code-barres",
  Supplier: "Fournisseur",
  GoodsReceipt: "Réception",
  Transfer: "Transfert",
  InventorySession: "Inventaire",
  InternalStockIssue: "Sortie interne",
  StockMovement: "Mouvement stock",
  StockLevel: "Solde stock",
  CashSession: "Session caisse",
  Sale: "Vente",
  Expense: "Dépense",
  ExchangeRate: "Taux",
  AppSetting: "Paramètre",
};

export function auditDomainLabel(domain: AuditDomain | ""): string {
  switch (domain) {
    case "":
      return "Tous les domaines";
    case "identity":
      return "Accès & identités";
    case "network":
      return "Réseau";
    case "catalog":
      return "Catalogue";
    case "stock":
      return "Stock";
    case "sales":
      return "Ventes & caisse";
    case "finance":
      return "Finance";
    case "settings":
      return "Paramètres";
    default: {
      const exhaustive: never = domain;
      return exhaustive;
    }
  }
}

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function auditActorName(item: AuditLogItem): string {
  if (!item.actor) {
    return "Système";
  }
  const name = `${item.actor.firstName} ${item.actor.lastName}`.trim();
  return name || item.actor.email;
}

export function auditActionTone(
  action: string,
  sensitive: boolean,
): "success" | "warning" | "neutral" | "muted" | "info" | "danger" {
  if (
    action.includes("DELETED") ||
    action.includes("VOIDED") ||
    action.includes("CANCELLED") ||
    action.includes("REJECTED") ||
    action.includes("DEACTIVATED")
  ) {
    return "danger";
  }
  if (sensitive || action.includes("UPDATED") || action.includes("VALIDATED") || action.includes("APPROVED")) {
    return "warning";
  }
  if (action.includes("CREATED") || action.includes("COMPLETED") || action === "LOGIN_SUCCESS") {
    return "success";
  }
  return "neutral";
}

export function auditEntityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Store":
      return `/admin/stores/${entityId}`;
    case "User":
      return `/admin/users/${entityId}`;
    case "Product":
      return `/admin/products/${entityId}`;
    case "Transfer":
      return `/admin/transfers/${entityId}`;
    case "Sale":
      return `/admin/sales/${entityId}`;
    case "CashSession":
      return `/admin/cash-sessions/${entityId}`;
    case "InventorySession":
      return `/admin/inventories/${entityId}`;
    case "InternalStockIssue":
      return `/admin/internal-issues/${entityId}`;
    case "Supplier":
      return `/admin/suppliers/${entityId}`;
    case "AppSetting":
      return "/admin/settings";
    case "ExchangeRate":
      return "/admin/exchange-rates";
    case "Warehouse":
      return "/admin/warehouse";
    case "Expense":
      return "/admin/expenses";
    case "StockMovement":
    case "StockLevel":
      return "/admin/stock";
    default:
      return null;
  }
}

export function formatAuditWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatAuditJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function shortEntityId(id: string): string {
  if (id.length <= 12) {
    return id;
  }
  return `${id.slice(0, 8)}…`;
}
