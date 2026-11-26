import type { AdminDashboardPayload } from "../../lib/api/dashboard";
import type { PaymentMethod } from "../../lib/api/types";
import { DEFAULT_DECAISSEMENT_CDF_PER_USD, DEFAULT_ENCAISSEMENT_CDF_PER_USD } from "../../lib/money/exchange-rate-defaults";
import { formatCdf, formatUsd } from "../catalog/money";
import { PAYMENT_METHOD_LABELS } from "../pos/pos-payments";

export function resolveDashboardRates(data: AdminDashboardPayload): {
  encaissementRate: number;
  decaissementRate: number;
} {
  return {
    encaissementRate: data.exchangeRate.encaissementRate ?? DEFAULT_ENCAISSEMENT_CDF_PER_USD,
    decaissementRate: data.exchangeRate.decaissementRate ?? DEFAULT_DECAISSEMENT_CDF_PER_USD,
  };
}

export function formatRecentSaleAmount(
  sale: AdminDashboardPayload["recentSales"][number],
): string {
  if (sale.currency === "CDF") {
    return formatCdf(sale.paidAmount);
  }
  return formatUsd(sale.totalUsd);
}

export function formatRecentSalePayment(method: PaymentMethod | null, currency: string): string {
  const label = method ? PAYMENT_METHOD_LABELS[method] : "—";
  return `${label} · ${currency}`;
}