import { apiRequest } from "./client";
import type { ExchangeRateRevision, ExchangeRateRow, ExchangeRatesCurrent } from "./types";

export type ExchangeRateType = "ENCAISSEMENT" | "DECAISSEMENT";

export function fetchCurrentExchangeRates(): Promise<ExchangeRatesCurrent> {
  return apiRequest("/exchange-rates/current");
}

export function fetchExchangeRateHistory(rateType: ExchangeRateType, take = 30): Promise<{ items: ExchangeRateRow[] }> {
  const query = new URLSearchParams({ take: String(take) });
  return apiRequest(`/exchange-rates/history/${rateType}?${query.toString()}`);
}

export function fetchExchangeRateRevisions(take = 30): Promise<{ items: ExchangeRateRevision[] }> {
  const query = new URLSearchParams({ take: String(take) });
  return apiRequest(`/exchange-rates/revisions?${query.toString()}`);
}

export function updateExchangeRate(payload: {
  rateType: ExchangeRateType;
  rate: number;
  reason?: string;
}): Promise<ExchangeRateRow> {
  return apiRequest("/exchange-rates", { method: "PATCH", body: JSON.stringify(payload) });
}

/** Mise à jour groupée encaissement + décaissement (modèle import-hd-eyano-app). */
export function updateExchangeRatesPair(payload: {
  encaissementRate: number;
  decaissementRate: number;
  reason?: string;
}): Promise<ExchangeRatesCurrent> {
  return apiRequest("/exchange-rates/pair", { method: "POST", body: JSON.stringify(payload) });
}