import type { CategoryStatus } from "../../lib/api/types";

export function categoryStatusLabel(status: CategoryStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "ARCHIVED":
      return "Archivée";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function categoryStatusTone(status: CategoryStatus): "success" | "neutral" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "ARCHIVED":
      return "neutral";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}
