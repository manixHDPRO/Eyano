/** Valeur `YYYY-MM-DD` pour `<input type="date">` (jour local). */
export function todayDateInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function completedAtRangeFromDateInputs(
  dateFrom: string,
  dateTo: string,
): { completedFrom?: string; completedTo?: string; error?: string } {
  const from = dateFrom.trim();
  const to = dateTo.trim();
  if (!from && !to) {
    return {};
  }
  if (from && to && from > to) {
    return { error: "La date de début doit être antérieure ou égale à la date de fin." };
  }
  const result: { completedFrom?: string; completedTo?: string } = {};
  if (from) {
    result.completedFrom = localDayStartIso(from);
  }
  if (to) {
    result.completedTo = localDayEndIso(to);
  }
  return result;
}

function localDayStartIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function localDayEndIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export function saleLocalDayKey(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatSaleDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatSaleTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}