import type { ReferentialStatus } from "../../lib/api/types";

export function referentialStatusLabel(status: ReferentialStatus): string {
  switch (status) {
    case "ACTIVE":
      return "En service";
    case "INACTIVE":
      return "Hors service";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function referentialStatusTone(status: ReferentialStatus): "success" | "neutral" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "INACTIVE":
      return "neutral";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}
