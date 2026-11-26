import type { StockAlertStatus } from "../../lib/api/types";

export function stockAlertLabel(status: StockAlertStatus): string {
  switch (status) {
    case "OK":
      return "Confortable";
    case "LOW":
      return "Sous seuil";
    case "STOCKOUT":
      return "Rupture";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function stockAlertTone(status: StockAlertStatus): "success" | "warning" | "neutral" | "muted" {
  switch (status) {
    case "OK":
      return "success";
    case "LOW":
      return "warning";
    case "STOCKOUT":
      return "neutral";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function movementTypeLabel(type: string): string {
  const map: Record<string, string> = {
    GOODS_RECEIPT: "Réception fournisseur",
    TRANSFER_OUT: "Transfert — sortie",
    TRANSFER_IN: "Transfert — entrée",
    SALE: "Vente",
    SALE_REVERSAL: "Annulation vente",
    INTERNAL_ISSUE: "Sortie interne",
    INVENTORY_ADJUSTMENT: "Inventaire",
    MANUAL_ADJUSTMENT: "Ajustement manuel",
  };
  return map[type] ?? type;
}

export function locationLabel(level: { warehouse: { code: string; name: string } | null; store: { code: string; name: string } | null }): string {
  if (level.warehouse) {
    return `Entrepôt ${level.warehouse.code}`;
  }
  if (level.store) {
    return `Boutique ${level.store.code}`;
  }
  return "—";
}