import type { ProductStatus } from "../../lib/api/types";

export function productStatusLabel(status: ProductStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "ACTIVE":
      return "Actif";
    case "INACTIVE":
      return "Inactif";
    case "ARCHIVED":
      return "Archivé";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function productStatusTone(status: ProductStatus): "success" | "warning" | "neutral" | "muted" {
  switch (status) {
    case "DRAFT":
      return "warning";
    case "ACTIVE":
      return "success";
    case "INACTIVE":
      return "neutral";
    case "ARCHIVED":
      return "muted";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function categoryPath(parentName: string | null, name: string): string {
  return parentName ? `${parentName} / ${name}` : name;
}
