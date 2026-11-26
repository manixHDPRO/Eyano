import type { InventoryStatus } from "../../lib/api/types";

export const INVENTORY_PIPELINE: InventoryStatus[] = [
  "DRAFT",
  "IN_PROGRESS",
  "PENDING_VALIDATION",
  "VALIDATED",
];

export function inventoryStatusLabel(status: InventoryStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "IN_PROGRESS":
      return "Ouvert";
    case "PENDING_VALIDATION":
      return "À valider";
    case "VALIDATED":
      return "Validé";
    case "CANCELLED":
      return "Annulé";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function inventoryStatusTone(
  status: InventoryStatus,
): "neutral" | "info" | "warning" | "success" | "danger" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "IN_PROGRESS":
      return "info";
    case "PENDING_VALIDATION":
      return "warning";
    case "VALIDATED":
      return "success";
    case "CANCELLED":
      return "danger";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function locationLabel(item: {
  scopeType: "WAREHOUSE" | "STORE";
  warehouse: { code: string; name: string } | null;
  store: { name: string; code: string } | null;
}): string {
  if (item.scopeType === "WAREHOUSE" && item.warehouse) {
    return `Entrepôt central — ${item.warehouse.name}`;
  }
  if (item.store) {
    return `Boutique ${item.store.code} — ${item.store.name}`;
  }
  return "Lieu non défini";
}

export function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

const inventoryDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatInventoryDateTime(value: string): string {
  return inventoryDateFormatter.format(new Date(value));
}

export function inventorySessionDateLines(session: {
  status: InventoryStatus;
  startedAt: string | null;
  closedAt: string | null;
}): { start: string | null; end: string | null } {
  const start = session.startedAt ? formatInventoryDateTime(session.startedAt) : null;
  const end = session.closedAt ? formatInventoryDateTime(session.closedAt) : null;
  if (session.status === "DRAFT") {
    return { start: null, end: null };
  }
  return { start, end };
}