export type ReportsPeriodPreset = "today" | "7d" | "30d" | "90d" | "ytd" | "all";

export const REPORTS_PERIOD_OPTIONS: { value: ReportsPeriodPreset; label: string }[] = [
  { value: "today", label: "Aujourd’hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "ytd", label: "Année en cours" },
  { value: "all", label: "Tout l’historique" },
];

export function computeReportsRange(period: ReportsPeriodPreset): { from?: string; to?: string } {
  if (period === "all") {
    return {};
  }
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (period === "90d") {
    start.setDate(start.getDate() - 89);
  } else if (period === "ytd") {
    start.setMonth(0, 1);
  }
  return { from: start.toISOString(), to: now.toISOString() };
}

export function formatReportsPeriodLabel(period: ReportsPeriodPreset): string {
  return REPORTS_PERIOD_OPTIONS.find((row) => row.value === period)?.label ?? period;
}

export function formatReportGeneratedAt(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}