import type { PaymentMethod } from "../../lib/api/types";

export type PosPaymentDraft = {
  localId: string;
  method: PaymentMethod;
  currency: "USD" | "CDF";
  amount: number;
  providerReference?: string;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  MPESA: "M-Pesa",
  ORANGE_MONEY: "Orange Money",
  AIRTEL_MONEY: "Airtel Money",
};

export function paymentRequiresReference(method: PaymentMethod): boolean {
  return method === "MPESA" || method === "ORANGE_MONEY" || method === "AIRTEL_MONEY";
}

export function roundHalfUp(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function convertCdfToUsd(amountCdf: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  return roundHalfUp(amountCdf / rate, 2);
}

export function convertUsdToCdf(amountUsd: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  return roundHalfUp(amountUsd * rate, 0);
}

/** Montant CDF à encaisser pour un total USD (aligné backend / import-hd-eyano-app). */
export function encaissementCdfTotal(totalUsd: number, encaissementRate: number): number {
  return convertUsdToCdf(totalUsd, encaissementRate);
}

export function draftToAmountUsd(draft: PosPaymentDraft, encaissementRate: number): number {
  if (draft.currency === "USD") {
    return roundHalfUp(draft.amount, 2);
  }
  return convertCdfToUsd(draft.amount, encaissementRate);
}

export function paidUsdTotal(drafts: PosPaymentDraft[], encaissementRate: number): number {
  const raw = drafts.reduce((sum, row) => sum + draftToAmountUsd(row, encaissementRate), 0);
  return roundHalfUp(raw, 2);
}

export function remainingUsd(saleTotalUsd: number, drafts: PosPaymentDraft[], encaissementRate: number): number {
  return roundHalfUp(saleTotalUsd - paidUsdTotal(drafts, encaissementRate), 2);
}