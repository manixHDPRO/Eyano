import type { SaleListItem } from "../../lib/api/types";
import { formatCdf, formatUsd } from "../catalog/money";
import { PAYMENT_METHOD_LABELS } from "../pos/pos-payments";

export function formatSalePaymentLabel(sale: SaleListItem): string {
  const method = sale.primaryPayment?.method ?? sale.paymentMethods[0];
  return method ? PAYMENT_METHOD_LABELS[method] : "—";
}

export function formatSaleCollected(sale: SaleListItem): string {
  const pay = sale.primaryPayment;
  if (!pay) {
    return formatUsd(sale.total);
  }
  if (pay.currency === "CDF") {
    return formatCdf(pay.amount);
  }
  return formatUsd(pay.amount);
}