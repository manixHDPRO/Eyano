import { EYANO_LOGO_ALT, EYANO_LOGO_SRC } from "../../lib/brand";
import { formatUsd } from "../catalog/money";
import type { TopSellingPrintPayload } from "./top-selling-print-data";

type TopSellingProductsPrintSheetProps = {
  payload: TopSellingPrintPayload;
};

export function TopSellingProductsPrintSheet({ payload }: TopSellingProductsPrintSheetProps) {
  const { report } = payload;
  const printedAt = new Date(payload.generatedAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const scope = `${report.store.code} — ${report.store.name} · ${payload.periodLabel}`;

  return (
    <article className="catalog-print" lang="fr" aria-label="Top ventes par quantité">
      <header className="catalog-print__mast">
        <div className="catalog-print__brand">
          <img src={EYANO_LOGO_SRC} alt={EYANO_LOGO_ALT} className="catalog-print__logo" width={140} height={36} />
        </div>
        <div className="catalog-print__edition">
          <p className="catalog-print__edition-count">{report.items.length}</p>
          <p className="catalog-print__edition-label">
            produit{report.items.length > 1 ? "s" : ""} classé{report.items.length > 1 ? "s" : ""}
          </p>
          <p className="catalog-print__edition-date">{printedAt}</p>
        </div>
      </header>

      <section className="catalog-print__report-title" aria-label="Titre du rapport">
        <h1>Produits les plus vendus (quantité)</h1>
        <p className="catalog-print__scope">{scope}</p>
      </section>

      <div className="catalog-print__table-wrap">
        <table className="catalog-print__table">
          <colgroup>
            <col className="catalog-print__col-rank" />
            <col className="catalog-print__col-ref" />
            <col className="catalog-print__col-name" />
            <col className="catalog-print__col-qty" />
            <col className="catalog-print__col-ca" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="catalog-print__num catalog-print__num--center">
                Rang
              </th>
              <th scope="col">Référence</th>
              <th scope="col">Désignation</th>
              <th scope="col" className="catalog-print__num catalog-print__num--center">
                Qté vendue
              </th>
              <th scope="col" className="catalog-print__num">
                CA USD
              </th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((row, index) => (
              <tr key={row.productId}>
                <td className="catalog-print__num catalog-print__num--center">{index + 1}</td>
                <td className="catalog-print__ref">{row.reference}</td>
                <td className="catalog-print__cell-name">
                  <span className="catalog-print__name">{row.name}</span>
                </td>
                <td className="catalog-print__num catalog-print__num--center catalog-print__num--strong">
                  {row.qtySold.toLocaleString("fr-FR")}
                </td>
                <td className="catalog-print__num">{formatUsd(row.revenueUsd)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="catalog-print__total-label">
                Total période
              </td>
              <td className="catalog-print__num catalog-print__num--center catalog-print__num--strong">
                {report.totalQtySold.toLocaleString("fr-FR")}
              </td>
              <td className="catalog-print__num catalog-print__num--strong">{formatUsd(report.totalRevenueUsd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <footer className="catalog-print__running-foot" aria-hidden="true">
        <span className="catalog-print__running-foot-brand">
          <img src={EYANO_LOGO_SRC} alt="" className="catalog-print__running-foot-logo" width={72} height={18} />
          Eyano
        </span>
        <span className="catalog-print__running-foot-meta">Document interne · {printedAt}</span>
        <span className="catalog-print__running-foot-scope">{scope}</span>
      </footer>
    </article>
  );
}
