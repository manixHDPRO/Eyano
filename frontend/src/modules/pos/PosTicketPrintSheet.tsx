import type { SaleDetail } from "../../lib/api/types";
import { PAYMENT_METHOD_LABELS } from "./pos-payments";
import { printCdf, printUsd } from "./pos-ticket-print-format";

/** Contenu réservé à l'impression thermique — ne pas réutiliser dans l'aperçu modal. */
export function PosTicketPrintSheet({ sale }: { sale: SaleDetail }) {
  const header = sale.store.receiptHeader?.trim() || sale.store.name;
  const footer = sale.store.receiptFooter?.trim() || "Merci de votre visite";
  const completed = new Date(sale.completedAt);
  const cashier = `${sale.cashier.firstName} ${sale.cashier.lastName}`.trim();
  const cdfPayments = sale.payments.filter((row) => row.currency === "CDF");
  const cdfTotal = cdfPayments.reduce((sum, row) => sum + row.amount, 0);
  const rateSnapshot = cdfPayments[0]?.rateSnapshot ?? null;

  return (
    <article className="pos-print-sheet">
      <header className="pos-print-sheet__center">
        <p className="pos-print-sheet__brand">{header}</p>
        {sale.store.city ? <p className="pos-print-sheet__sub">{sale.store.city}</p> : null}
      </header>

      <div className="pos-print-sheet__rule" />

      <div className="pos-print-sheet__block">
        <Line label="Ticket" value={sale.number} />
        <Line
          label="Date"
          value={`${completed.toLocaleDateString("fr-FR")} ${completed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
        />
        <Line label="Caissier" value={cashier} />
      </div>

      <div className="pos-print-sheet__rule" />

      <table className="pos-print-sheet__table">
        <colgroup>
          <col className="pos-print-col-name" />
          <col className="pos-print-col-qty" />
          <col className="pos-print-col-pu" />
          <col className="pos-print-col-total" />
        </colgroup>
        <thead>
          <tr>
            <th>Article</th>
            <th>Qté</th>
            <th>P.U.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((line) => (
            <tr key={line.id}>
              <td className="pos-print-sheet__name-cell">
                <span className="pos-print-sheet__name">{line.name}</span>
                <span className="pos-print-sheet__ref">{line.reference}</span>
                {line.discountPercent > 0 ? (
                  <span className="pos-print-sheet__ref">−{line.discountPercent}%</span>
                ) : null}
              </td>
              <td className="pos-print-sheet__num">{line.quantity}</td>
              <td className="pos-print-sheet__num">{printUsd(line.finalUnitPrice)}</td>
              <td className="pos-print-sheet__num pos-print-sheet__num--strong">{printUsd(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pos-print-sheet__rule" />

      <div className="pos-print-sheet__block">
        <Line label="Sous-total" value={printUsd(sale.subtotal)} />
        {sale.discountTotal > 0 ? <Line label="Remises" value={`−${printUsd(sale.discountTotal)}`} /> : null}
        <Line label="NET À PAYER" value={printUsd(sale.total)} strong />
        {cdfPayments.length > 0 && rateSnapshot != null ? (
          <Line label={`CDF (taux ${rateSnapshot.toLocaleString("fr-FR")})`} value={printCdf(cdfTotal)} />
        ) : null}
      </div>

      {sale.payments.length > 0 ? (
        <>
          <div className="pos-print-sheet__rule" />
          <p className="pos-print-sheet__heading">Encaissement</p>
          <div className="pos-print-sheet__block">
            {sale.payments.map((payment) => (
              <Line
                key={payment.id}
                label={`${PAYMENT_METHOD_LABELS[payment.method]} ${payment.amount.toFixed(payment.currency === "USD" ? 2 : 0)} ${payment.currency}`}
                value={printUsd(payment.amountUsd)}
              />
            ))}
          </div>
        </>
      ) : null}

      <div className="pos-print-sheet__rule" />

      <p className="pos-print-sheet__footer">{footer}</p>
    </article>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`pos-print-sheet__line${strong ? " pos-print-sheet__line--strong" : ""}`}>
      <span className="pos-print-sheet__line-label">{label}</span>
      <span className="pos-print-sheet__line-value">{value}</span>
    </div>
  );
}