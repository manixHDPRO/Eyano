import type { GoodsReceiptStatus } from "../../lib/api/types";

export function goodsReceiptStatusLabel(status: GoodsReceiptStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "VALIDATED":
      return "Validée";
    case "CANCELLED":
      return "Annulée";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function goodsReceiptStatusTone(status: GoodsReceiptStatus): "neutral" | "success" | "warning" {
  switch (status) {
    case "DRAFT":
      return "warning";
    case "VALIDATED":
      return "success";
    case "CANCELLED":
      return "neutral";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}