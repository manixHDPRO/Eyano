import type { SaleListItem } from "../../lib/api/types";

export function saleStatusLabel(status: SaleListItem["status"]): string {
  return status === "VOIDED" ? "Annulée" : "Validée";
}

export function saleStatusTone(status: SaleListItem["status"]): "success" | "danger" {
  return status === "VOIDED" ? "danger" : "success";
}