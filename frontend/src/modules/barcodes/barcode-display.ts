import type { BarcodeCoverage, BarcodePrintContext } from "../../lib/api/types";

export function coverageLabel(coverage: BarcodeCoverage): string {
  switch (coverage) {
    case "ALL":
      return "Tous";
    case "CODED":
      return "Codés";
    case "MISSING":
      return "Sans code";
    default: {
      const unexpected: never = coverage;
      return unexpected;
    }
  }
}

export function printContextLabel(context: BarcodePrintContext): string {
  switch (context) {
    case "SINGLE":
      return "Unitaire";
    case "BATCH":
      return "Lot";
    default: {
      const unexpected: never = context;
      return unexpected;
    }
  }
}

export function formatPrintWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Kinshasa",
  }).format(new Date(iso));
}
