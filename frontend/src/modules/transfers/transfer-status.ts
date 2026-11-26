import type { TransferStatus } from "../../lib/api/types";

export function transferStatusLabel(status: TransferStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "PENDING":
      return "En attente";
    case "VALIDATED":
      return "Validé";
    case "PREPARING":
      return "En préparation";
    case "SHIPPED":
      return "Expédié";
    case "PARTIALLY_RECEIVED":
      return "Partiellement réceptionné";
    case "RECEIVED":
      return "Réceptionné";
    case "CANCELLED":
      return "Annulé";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function transferStatusTone(
  status: TransferStatus,
): "success" | "warning" | "neutral" | "muted" | "info" | "danger" {
  switch (status) {
    case "DRAFT":
      return "muted";
    case "PENDING":
      return "warning";
    case "VALIDATED":
      return "info";
    case "PREPARING":
      return "info";
    case "SHIPPED":
      return "warning";
    case "PARTIALLY_RECEIVED":
      return "warning";
    case "RECEIVED":
      return "success";
    case "CANCELLED":
      return "neutral";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function transferNextActionLabel(status: TransferStatus): string | null {
  switch (status) {
    case "DRAFT":
      return "Soumettre";
    case "PENDING":
      return "Valider";
    case "VALIDATED":
      return "Préparer";
    case "PREPARING":
      return "Expédier";
    case "SHIPPED":
    case "PARTIALLY_RECEIVED":
      return "Réceptionner";
    case "RECEIVED":
    case "CANCELLED":
      return null;
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function personName(person: { firstName: string; lastName: string } | null | undefined): string {
  if (!person) return "—";
  return `${person.firstName} ${person.lastName}`.trim();
}
