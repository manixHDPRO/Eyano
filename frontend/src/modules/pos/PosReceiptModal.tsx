import { useState } from "react";
import type { SaleDetail } from "../../lib/api/types";
import { formatCdf, formatUsd } from "../catalog/money";
import { PAYMENT_METHOD_LABELS } from "./pos-payments";
import { PosTicketPrint } from "./PosTicketPrint";

type PosReceiptModalProps = {
  sale: SaleDetail;
  onClose: () => void;
};

export function PosReceiptModal({ sale, onClose }: PosReceiptModalProps) {
  const [printRequested, setPrintRequested] = useState(false);
  const header = sale.store.receiptHeader?.trim() || sale.store.name;
  const footer = sale.store.receiptFooter?.trim() || "Merci de votre visite";
  const cdfPayments = sale.payments.filter((row) => row.currency === "CDF");
  const rateSnapshot = cdfPayments[0]?.rateSnapshot ?? null;
  const completed = new Date(sale.completedAt);
  const cashier = `${sale.cashier.firstName} ${sale.cashier.lastName}`.trim();

  return (
    <>
      {printRequested ? (
        <PosTicketPrint sale={sale} onPrinted={() => setPrintRequested(false)} />
      ) : null}

      <div
        className="pos-receipt-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-receipt-title"
      >
        <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
            <h3 id="pos-receipt-title" className="text-sm font-semibold text-slate-900">
              Ticket de caisse
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-5">
            <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 font-mono text-xs text-slate-900">
              <div className="border-b border-dashed border-slate-300 pb-3 text-center">
                <p className="text-sm font-bold uppercase tracking-tight">{header}</p>
                {sale.store.city ? <p className="mt-0.5 text-[11px] text-slate-600">{sale.store.city}</p> : null}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2.5 text-[11px]">
                <ReceiptRow label="Ticket N°" value={sale.number} />
                <ReceiptRow label="Date" value={completed.toLocaleString("fr-FR")} />
                <ReceiptRow label="Caissier" value={cashier} />
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
                <div className="grid grid-cols-12 text-[10px] font-semibold uppercase text-slate-600">
                  <span className="col-span-5">Article</span>
                  <span className="col-span-2 text-right">Qté</span>
                  <span className="col-span-2 text-right">Rem.</span>
                  <span className="col-span-3 text-right">Total</span>
                </div>
                {sale.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 items-start">
                    <span className="col-span-5 font-medium leading-tight">{item.name}</span>
                    <span className="col-span-2 text-right tabular-nums">{item.quantity}</span>
                    <span className="col-span-2 text-right tabular-nums">
                      {item.discountPercent > 0 ? `-${item.discountPercent}%` : "0%"}
                    </span>
                    <span className="col-span-3 text-right font-semibold tabular-nums">{formatUsd(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2.5 text-[11px]">
                <ReceiptRow label="Sous-total initial" value={formatUsd(sale.subtotal)} muted />
                {sale.discountTotal > 0 ? (
                  <ReceiptRow label="Total remises" value={`-${formatUsd(sale.discountTotal)}`} muted />
                ) : null}
                <div className="flex justify-between pt-1 text-sm font-bold">
                  <span>NET À PAYER (USD)</span>
                  <span className="tabular-nums">{formatUsd(sale.total)}</span>
                </div>
                {cdfPayments.length > 0 && rateSnapshot != null ? (
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>TOTAL CDF ENCAISSÉ (taux {rateSnapshot.toLocaleString("fr-FR")})</span>
                    <span className="tabular-nums">{formatCdf(cdfPayments.reduce((sum, row) => sum + row.amount, 0))}</span>
                  </div>
                ) : null}
              </div>

              {sale.payments.length > 0 ? (
                <div className="space-y-1.5 text-[11px]">
                  <p className="font-semibold text-slate-800">Détail encaissement</p>
                  <ul className="space-y-1">
                    {sale.payments.map((payment) => (
                      <li key={payment.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                        <div className="flex justify-between gap-2 font-semibold">
                          <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
                          <span className="tabular-nums">
                            {payment.amount.toFixed(payment.currency === "USD" ? 2 : 0)} {payment.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Contre-valeur</span>
                          <span className="tabular-nums">{formatUsd(payment.amountUsd)}</span>
                        </div>
                        {payment.providerReference ? (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">Réf. {payment.providerReference}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">{footer}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => setPrintRequested(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Imprimer le ticket
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReceiptRow(props: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-2 ${props.muted ? "text-slate-600" : ""} ${props.strong ? "font-semibold" : ""}`}
    >
      <span>{props.label}</span>
      <span className="tabular-nums">{props.value}</span>
    </div>
  );
}