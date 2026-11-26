/** Échelles monétaires Eyano (cahier §8). */
export const USD_DECIMALS = 2;
export const CDF_DECIMALS = 0;

export function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function moneyString(value: number | string, decimals = USD_DECIMALS): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return (0).toFixed(decimals);
  }
  return roundHalfUp(numeric, decimals).toFixed(decimals);
}

/** Prix final unitaire : arrondi half-up sur l’unité, puis × quantité en caisse. */
export function computeFinalPrice(officialPrice: number, discountPercent: number): string {
  const official = Number(officialPrice);
  const discount = Number(discountPercent);
  const raw = official * (1 - discount / 100);
  return moneyString(raw, USD_DECIMALS);
}

export function computeDiscountAmount(officialPrice: number, discountPercent: number): string {
  const finalUnit = Number(computeFinalPrice(officialPrice, discountPercent));
  const official = roundHalfUp(Number(officialPrice), USD_DECIMALS);
  return moneyString(official - finalUnit, USD_DECIMALS);
}

/** Contre-valeur USD d’un montant CDF au taux d’encaissement (1 USD = `rate` CDF). */
export function convertCdfToUsd(amountCdf: number, encaissementRate: number): string {
  if (!Number.isFinite(encaissementRate) || encaissementRate <= 0) {
    return moneyString(0, USD_DECIMALS);
  }
  return moneyString(amountCdf / encaissementRate, USD_DECIMALS);
}

/** Montant CDF équivalent à un total USD au taux d’encaissement (arrondi entier CDF). */
export function convertUsdToCdf(amountUsd: number, encaissementRate: number): string {
  if (!Number.isFinite(encaissementRate) || encaissementRate <= 0) {
    return moneyString(0, CDF_DECIMALS);
  }
  return moneyString(amountUsd * encaissementRate, CDF_DECIMALS);
}