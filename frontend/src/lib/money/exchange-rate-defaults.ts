/** Valeurs de repli alignées sur import-hd-eyano-app (seed 24 000 / 22 500). */
export const DEFAULT_ENCAISSEMENT_CDF_PER_USD = 24_000;
export const DEFAULT_DECAISSEMENT_CDF_PER_USD = 22_500;

export function formatCdfPerUsd(rate: number): string {
  return Number.isFinite(rate) ? rate.toLocaleString("fr-FR") : "—";
}

export function formatUsdEqualsCdf(encaissementRate: number): string {
  return `1 USD = ${formatCdfPerUsd(encaissementRate)} CDF`;
}