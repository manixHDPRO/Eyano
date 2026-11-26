/** Montants compacts pour ticket thermique 80 mm (hors modal). */
export function printUsd(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " $"
  );
}

export function printCdf(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(n)) + " CDF"
  );
}