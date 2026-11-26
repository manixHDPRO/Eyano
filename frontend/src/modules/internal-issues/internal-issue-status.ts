import type { InternalIssueReason, InternalIssueScopeType, InternalIssueStatus } from "../../lib/api/types";

export const INTERNAL_ISSUE_PIPELINE: InternalIssueStatus[] = ["DRAFT", "PENDING", "APPROVED"];

export function internalIssueStatusLabel(status: InternalIssueStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "PENDING":
      return "En attente";
    case "APPROVED":
      return "Validée";
    case "REJECTED":
      return "Rejetée";
    case "CANCELLED":
      return "Annulée";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function internalIssueStatusTone(
  status: InternalIssueStatus,
): "neutral" | "info" | "warning" | "success" | "danger" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "PENDING":
      return "warning";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "CANCELLED":
      return "neutral";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function internalIssueReasonLabel(code: InternalIssueReason): string {
  switch (code) {
    case "CLEANING":
      return "Nettoyage / hygiène";
    case "MAINTENANCE":
      return "Maintenance équipement";
    case "INTERNAL_USE":
      return "Usage interne";
    case "DAMAGED":
      return "Produit endommagé";
    case "OTHER":
      return "Autre (à préciser)";
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

export function locationLabel(detail: {
  scopeType: InternalIssueScopeType;
  warehouse: { code: string; name: string } | null;
  store: { code: string; name: string } | null;
}): string {
  if (detail.scopeType === "WAREHOUSE" && detail.warehouse) {
    return `Entrepôt central — ${detail.warehouse.name}`;
  }
  if (detail.store) {
    return detail.store.name;
  }
  return "Lieu inconnu";
}

export function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function locationKeyFromOption(option: {
  scopeType: InternalIssueScopeType;
  warehouse?: { id: string };
  store?: { id: string };
}): string {
  if (option.scopeType === "WAREHOUSE" && option.warehouse) {
    return `w:${option.warehouse.id}`;
  }
  if (option.store) {
    return `s:${option.store.id}`;
  }
  return "";
}