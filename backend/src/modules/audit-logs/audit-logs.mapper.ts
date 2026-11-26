import { Prisma } from "@prisma/client";
import { AUDIT_ACTION, isSensitiveAuditAction } from "./audit-logs.constants";

export type AuditActorSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
} | null;

export type AuditStoreSummary = {
  id: string;
  code: string;
  name: string;
} | null;

export type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  storeId: string | null;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: AuditActorSummary;
  store: AuditStoreSummary;
  summary: string;
  sensitive: boolean;
};

type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  storeId: string | null;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  actor: AuditActorSummary;
  store: AuditStoreSummary;
};

export function toAuditLogItem(row: AuditLogRow): AuditLogItem {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    storeId: row.storeId,
    oldValue: row.oldValue,
    newValue: row.newValue,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    store: row.store,
    summary: summarizeAudit(row.action, row.entityType, row.entityId, row.oldValue, row.newValue),
    sensitive: isSensitiveAuditAction(row.action),
  };
}

export function summarizeAudit(
  action: string,
  entityType: string,
  entityId: string,
  oldValue: Prisma.JsonValue | null,
  newValue: Prisma.JsonValue | null,
): string {
  const settingKey = readString(newValue, "key") ?? readString(oldValue, "key");
  const reference = readString(newValue, "reference") ?? readString(oldValue, "reference");
  const note = readString(newValue, "reason") ?? readString(newValue, "note");

  switch (action) {
    case AUDIT_ACTION.LOGIN_SUCCESS:
      return "Connexion réussie.";
    case AUDIT_ACTION.USER_CREATED:
      return `Compte créé${suffix(readString(newValue, "email"))}.`;
    case AUDIT_ACTION.USER_UPDATED:
      return "Fiche utilisateur mise à jour.";
    case AUDIT_ACTION.USER_DEACTIVATED:
      return "Compte désactivé et sessions révoquées.";
    case AUDIT_ACTION.USER_STORES_UPDATED:
      return "Affectation boutiques mise à jour.";
    case AUDIT_ACTION.ROLE_PERMISSIONS_UPDATED:
      return "Matrice de permissions du rôle modifiée.";
    case AUDIT_ACTION.STORE_CREATED:
      return "Boutique créée avec sa caisse par défaut.";
    case AUDIT_ACTION.STORE_UPDATED:
      return "Fiche boutique mise à jour.";
    case AUDIT_ACTION.STORE_DELETED:
      return "Boutique supprimée.";
    case AUDIT_ACTION.WAREHOUSE_UPDATED:
      return "Fiche entrepôt mise à jour.";
    case AUDIT_ACTION.CASH_REGISTER_CREATED:
      return "Caisse créée.";
    case AUDIT_ACTION.CASH_REGISTER_UPDATED:
      return "Caisse mise à jour.";
    case AUDIT_ACTION.CATEGORY_CREATED:
      return "Catégorie créée.";
    case AUDIT_ACTION.CATEGORY_UPDATED:
      return "Catégorie mise à jour.";
    case AUDIT_ACTION.CATEGORY_DELETED:
      return "Catégorie supprimée.";
    case AUDIT_ACTION.PRODUCT_CREATED:
      return "Produit créé.";
    case AUDIT_ACTION.PRODUCT_UPDATED:
      return "Fiche produit mise à jour.";
    case AUDIT_ACTION.PRODUCT_PHOTO_UPDATED:
      return "Photo produit mise à jour.";
    case AUDIT_ACTION.PRODUCT_DELETED:
      return "Produit supprimé.";
    case AUDIT_ACTION.PRODUCT_STORES_UPDATED:
      return "Autorisations produit / boutiques mises à jour.";
    case AUDIT_ACTION.PRODUCT_PRICE_UPDATED:
      return "Prix catalogue modifié.";
    case AUDIT_ACTION.PRODUCT_DISCOUNT_UPDATED:
      return "Remise produit modifiée.";
    case AUDIT_ACTION.BARCODE_GENERATED:
      return "Code-barres généré.";
    case AUDIT_ACTION.BARCODE_PRINTED:
      return "Impression de codes-barres.";
    case AUDIT_ACTION.SUPPLIER_CREATED:
      return "Fournisseur créé.";
    case AUDIT_ACTION.SUPPLIER_UPDATED:
      return "Fournisseur mis à jour.";
    case AUDIT_ACTION.GOODS_RECEIPT_CREATED:
      return `Réception fournisseur créée${suffix(reference)}.`;
    case AUDIT_ACTION.GOODS_RECEIPT_UPDATED:
      return `Réception fournisseur mise à jour${suffix(reference)}.`;
    case AUDIT_ACTION.GOODS_RECEIPT_ITEMS_UPDATED:
      return "Lignes de réception fournisseur mises à jour.";
    case AUDIT_ACTION.GOODS_RECEIPT_VALIDATED:
      return `Réception fournisseur validée${suffix(reference)}.`;
    case AUDIT_ACTION.GOODS_RECEIPT_CANCELLED:
      return `Réception fournisseur annulée${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_CREATED:
      return `Transfert créé${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_UPDATED:
      return `Transfert mis à jour${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_ITEMS_UPDATED:
      return "Lignes de transfert mises à jour.";
    case AUDIT_ACTION.TRANSFER_SUBMITTED:
      return `Transfert soumis${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_VALIDATED:
      return `Transfert validé${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_PREPARED:
      return `Transfert préparé${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_SHIPPED:
      return `Transfert expédié${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_RECEIVED:
      return `Transfert réceptionné${suffix(reference)}.`;
    case AUDIT_ACTION.TRANSFER_CANCELLED:
      return `Transfert annulé${suffix(note)}.`;
    case AUDIT_ACTION.INVENTORY_CREATED:
      return `Inventaire créé${suffix(reference)}.`;
    case AUDIT_ACTION.INVENTORY_UPDATED:
      return "Inventaire mis à jour.";
    case AUDIT_ACTION.INVENTORY_STARTED:
      return "Inventaire démarré.";
    case AUDIT_ACTION.INVENTORY_ITEMS_UPDATED:
      return "Comptages d’inventaire mis à jour.";
    case AUDIT_ACTION.INVENTORY_SUBMITTED:
      return "Inventaire soumis.";
    case AUDIT_ACTION.INVENTORY_VALIDATED:
      return "Inventaire validé — ajustements de stock.";
    case AUDIT_ACTION.INVENTORY_CANCELLED:
      return "Inventaire annulé.";
    case AUDIT_ACTION.INTERNAL_ISSUE_CREATED:
      return "Sortie interne créée.";
    case AUDIT_ACTION.INTERNAL_ISSUE_UPDATED:
      return "Sortie interne mise à jour.";
    case AUDIT_ACTION.INTERNAL_ISSUE_SUBMITTED:
      return "Sortie interne soumise.";
    case AUDIT_ACTION.INTERNAL_ISSUE_STORE_CONFIRMED:
      return "Sortie interne confirmée en boutique.";
    case AUDIT_ACTION.INTERNAL_ISSUE_APPROVED:
      return "Sortie interne approuvée.";
    case AUDIT_ACTION.INTERNAL_ISSUE_REJECTED:
      return "Sortie interne rejetée.";
    case AUDIT_ACTION.INTERNAL_ISSUE_CANCELLED:
      return "Sortie interne annulée.";
    case AUDIT_ACTION.STOCK_MANUAL_ADJUSTMENT:
      return "Ajustement manuel de stock.";
    case AUDIT_ACTION.STOCK_RECONCILE:
      return "Réconciliation des soldes (lecture).";
    case AUDIT_ACTION.CASH_SESSION_OPENED:
      return "Session de caisse ouverte.";
    case AUDIT_ACTION.CASH_SESSION_CLOSED: {
      const variance = readNumber(newValue, "varianceUsd");
      if (variance !== null && variance !== 0) {
        return `Clôture de caisse avec écart (${variance > 0 ? "+" : ""}${variance} USD).`;
      }
      return "Session de caisse clôturée.";
    }
    case AUDIT_ACTION.SALE_COMPLETED:
      return `Vente enregistrée${suffix(reference)}.`;
    case AUDIT_ACTION.SALE_VOIDED:
      return `Vente annulée${suffix(note)}.`;
    case AUDIT_ACTION.EXPENSE_CREATED:
      return `Dépense enregistrée${suffix(reference)}.`;
    case AUDIT_ACTION.EXPENSE_RECEIPT_UPDATED:
      return "Justificatif de dépense mis à jour.";
    case AUDIT_ACTION.EXPENSE_CASHIER_CONFIRMED:
      return `Dépense tiroir confirmée${suffix(reference)}.`;
    case AUDIT_ACTION.EXCHANGE_RATE_UPDATED:
      return "Taux de change mis à jour.";
    case AUDIT_ACTION.SETTING_UPDATED:
      return settingKey ? `Paramètre « ${settingKey} » modifié.` : "Paramètre applicatif modifié.";
    default:
      return `${action} sur ${entityType}${entityId ? ` (${shortId(entityId)})` : ""}.`;
  }
}

function suffix(value: string | null): string {
  return value ? ` (${value})` : "";
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: Prisma.JsonValue | null, key: string): string | null {
  const record = asRecord(value);
  const field = record?.[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function readNumber(value: Prisma.JsonValue | null, key: string): number | null {
  const record = asRecord(value);
  const field = record?.[key];
  if (typeof field === "number" && Number.isFinite(field)) {
    return field;
  }
  if (typeof field === "string") {
    const parsed = Number(field);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
