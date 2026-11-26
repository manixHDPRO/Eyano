import { EYANO_LOGO_ALT, EYANO_LOGO_SRC } from "../../lib/brand";
import type { PosDailySalesReport } from "../../lib/api/types";
import { formatCdf, formatUsd } from "../catalog/money";
import { PAYMENT_METHOD_LABELS } from "./pos-payments";

type PosDailySalesReportPrintSheetProps = {
  report: PosDailySalesReport;
};

export function PosDailySalesReportPrintSheet({ report }: PosDailySalesReportPrintSheetProps) {
  const title = report.store.receiptHeader?.trim() || report.store.name;
  const generated = new Date(report.generatedAt);
  const reportDay = new Date(`${report.reportDate}T12:00:00`);
  const completedTickets = report.tickets.filter((row) => row.status === "COMPLETED");
  const voidedTickets = report.tickets.filter((row) => row.status === "VOIDED");

  return (
    <article className="pos-daily-a4" aria-label="Rapport ventes journalier">
      <header className="pos-daily-a4__hero">
        <div className="pos-daily-a4__hero-brand">
          <img src={EYANO_LOGO_SRC} alt={EYANO_LOGO_ALT} className="pos-daily-a4__logo" width={140} height={36} />
          <p className="pos-daily-a4__doc-type">Ventes · Caisse</p>
        </div>
        <div className="pos-daily-a4__hero-title">
          <h1>Rapport des ventes journalier</h1>
          <p className="pos-daily-a4__store">{title}</p>
          {report.store.city ? <p className="pos-daily-a4__city">{report.store.city}</p> : null}
        </div>
        <dl className="pos-daily-a4__meta">
          <MetaItem
            label="Journée"
            value={reportDay.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          />
          <MetaItem label="Terminal" value={`${report.cashRegister.code} — ${report.cashRegister.name}`} />
          <MetaItem
            label="Édité le"
            value={`${generated.toLocaleDateString("fr-FR")} à ${generated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
          />
          <MetaItem label="Boutique (code)" value={`${report.store.name} · ${report.store.code}`} />
        </dl>
      </header>

      <section className="pos-daily-a4__kpis" aria-label="Synthèse">
        <KpiCard
          label="Ventes validées"
          value={String(report.totals.completedSales)}
          hint={`${completedTickets.length} ticket(s) listé(s)`}
          tone="emerald"
        />
        <KpiCard label="Chiffre d'affaires" value={formatUsd(report.totals.grossUsd)} hint="Montants ticket en USD" tone="slate" strong />
        <KpiCard
          label="Annulations"
          value={String(report.totals.voidedSales)}
          hint={report.totals.voidedSales > 0 ? "Tickets annulés du jour" : "Aucune annulation"}
          tone="amber"
        />
      </section>

      <div className="pos-daily-a4__grid-two">
        <section className="pos-daily-a4__panel">
          <h2 className="pos-daily-a4__section-title">Encaissements par mode</h2>
          <p className="pos-daily-a4__section-lead">Contre-valeur USD des lignes de paiement (incl. mobile money).</p>
          {report.paymentBreakdown.length === 0 ? (
            <p className="pos-daily-a4__empty">Aucun encaissement enregistré ce jour.</p>
          ) : (
            <table className="pos-daily-a4__table">
              <thead>
                <tr>
                  <th scope="col">Mode</th>
                  <th scope="col" className="pos-daily-a4__num">
                    Lignes
                  </th>
                  <th scope="col" className="pos-daily-a4__num">
                    Montant USD
                  </th>
                  <th scope="col" className="pos-daily-a4__num">
                    CDF espèces
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.paymentBreakdown.map((row) => (
                  <tr key={row.method}>
                    <td>{PAYMENT_METHOD_LABELS[row.method]}</td>
                    <td className="pos-daily-a4__num">{row.paymentLines}</td>
                    <td className="pos-daily-a4__num pos-daily-a4__num--strong">{formatUsd(row.amountUsd)}</td>
                    <td className="pos-daily-a4__num">{row.cashCdfCollected > 0 ? formatCdf(row.cashCdfCollected) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="pos-daily-a4__panel">
          <h2 className="pos-daily-a4__section-title">Performance par caissier</h2>
          <p className="pos-daily-a4__section-lead">Ventes validées sur ce terminal pendant la journée.</p>
          {report.cashierBreakdown.length === 0 ? (
            <p className="pos-daily-a4__empty">Aucune vente caissier pour cette journée.</p>
          ) : (
            <table className="pos-daily-a4__table">
              <thead>
                <tr>
                  <th scope="col">Caissier</th>
                  <th scope="col" className="pos-daily-a4__num">
                    Tickets
                  </th>
                  <th scope="col" className="pos-daily-a4__num">
                    Total USD
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.cashierBreakdown.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className="pos-daily-a4__num">{row.sales}</td>
                    <td className="pos-daily-a4__num pos-daily-a4__num--strong">{formatUsd(row.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {report.openSession ? (
        <section className="pos-daily-a4__session" aria-label="Session de caisse ouverte">
          <div className="pos-daily-a4__session-head">
            <h2 className="pos-daily-a4__section-title">Session de caisse en cours</h2>
            <p className="pos-daily-a4__session-id">Réf. {report.openSession.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="pos-daily-a4__session-grid">
            <SessionCell
              label="Ouverture"
              value={new Date(report.openSession.openedAt).toLocaleString("fr-FR")}
              sub={report.openSession.openedByName}
            />
            <SessionCell
              label="Fond initial"
              value={formatUsd(report.openSession.openingFloatUsd)}
              sub={formatCdf(report.openSession.openingFloatCdf)}
            />
            <SessionCell
              label="Encaissements session"
              value={formatUsd(report.openSession.collectionsUsd)}
              sub={formatCdf(report.openSession.collectionsCdf)}
            />
            <SessionCell
              label="Dépenses tiroir"
              value={formatUsd(report.openSession.expensesUsd)}
              sub={formatCdf(report.openSession.expensesCdf)}
            />
            <SessionCell
              label="Solde théorique"
              value={formatUsd(report.openSession.theoreticalBalanceUsd)}
              sub={formatCdf(report.openSession.theoreticalBalanceCdf)}
              emphasis
            />
            <SessionCell label="Ventes sur la session" value={String(report.openSession.salesOnSession)} sub="Tickets validés" />
          </div>
        </section>
      ) : null}

      <section className="pos-daily-a4__panel pos-daily-a4__panel--wide">
        <div className="pos-daily-a4__panel-head">
          <h2 className="pos-daily-a4__section-title">Journal des tickets</h2>
          <p className="pos-daily-a4__badge">
            {report.tickets.length} mouvement{report.tickets.length > 1 ? "s" : ""}
            {voidedTickets.length > 0 ? ` · ${voidedTickets.length} annulé${voidedTickets.length > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {report.tickets.length === 0 ? (
          <p className="pos-daily-a4__empty pos-daily-a4__empty--center">Aucune vente sur cette journée pour cette caisse.</p>
        ) : (
          <table className="pos-daily-a4__table pos-daily-a4__table--journal">
            <thead>
              <tr>
                <th scope="col">N° ticket</th>
                <th scope="col">Heure</th>
                <th scope="col">Caissier</th>
                <th scope="col">Statut</th>
                <th scope="col" className="pos-daily-a4__num">
                  Total USD
                </th>
              </tr>
            </thead>
            <tbody>
              {report.tickets.map((ticket) => {
                const voided = ticket.status === "VOIDED";
                return (
                  <tr key={`${ticket.number}-${ticket.completedAt}`} className={voided ? "pos-daily-a4__row--void" : undefined}>
                    <td className="pos-daily-a4__ticket-num">{ticket.number}</td>
                    <td>
                      {new Date(ticket.completedAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td>{ticket.cashierName}</td>
                    <td>
                      <span className={voided ? "pos-daily-a4__status pos-daily-a4__status--void" : "pos-daily-a4__status"}>
                        {voided ? "Annulé" : "Validé"}
                      </span>
                    </td>
                    <td className="pos-daily-a4__num pos-daily-a4__num--strong">{voided ? "—" : formatUsd(ticket.totalUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <footer className="pos-daily-a4__footer">
        <p>Document généré par Eyano · usage interne boutique</p>
        <p>
          {report.store.name} — {report.cashRegister.code} — {reportDay.toLocaleDateString("fr-FR")}
        </p>
      </footer>
    </article>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function KpiCard(props: { label: string; value: string; hint: string; tone: "emerald" | "slate" | "amber"; strong?: boolean }) {
  return (
    <div className={`pos-daily-a4__kpi pos-daily-a4__kpi--${props.tone}`}>
      <p className="pos-daily-a4__kpi-label">{props.label}</p>
      <p className={`pos-daily-a4__kpi-value${props.strong ? " pos-daily-a4__kpi-value--strong" : ""}`}>{props.value}</p>
      <p className="pos-daily-a4__kpi-hint">{props.hint}</p>
    </div>
  );
}

function SessionCell(props: { label: string; value: string; sub?: string; emphasis?: boolean }) {
  return (
    <div className={`pos-daily-a4__session-cell${props.emphasis ? " pos-daily-a4__session-cell--emphasis" : ""}`}>
      <p className="pos-daily-a4__session-label">{props.label}</p>
      <p className="pos-daily-a4__session-value">{props.value}</p>
      {props.sub ? <p className="pos-daily-a4__session-sub">{props.sub}</p> : null}
    </div>
  );
}