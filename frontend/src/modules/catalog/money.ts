export function formatUsd(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCdf(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "CDF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? Math.round(value) : 0);
}

export function computeFinalPrice(officialPrice: number, discountPercent: number): number {
  const official = Number.isFinite(officialPrice) ? officialPrice : 0;
  const discount = Number.isFinite(discountPercent) ? discountPercent : 0;
  return Math.round((official * (1 - discount / 100) + Number.EPSILON) * 100) / 100;
}
