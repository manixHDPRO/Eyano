import { EYANO_LOGO_ALT, EYANO_LOGO_SRC } from "../../lib/brand";
import { formatUsd } from "./money";
import { categoryPath, productStatusLabel } from "./product-status";
import type { ProductsCatalogPrintPayload } from "./products-catalog-print-data";

type ProductsCatalogPrintSheetProps = {
  payload: ProductsCatalogPrintPayload;
};

export function ProductsCatalogPrintSheet({ payload }: ProductsCatalogPrintSheetProps) {
  const generated = new Date(payload.generatedAt);
  const filterParts: string[] = [];
  if (payload.filters.search) {
    filterParts.push(`Recherche « ${payload.filters.search} »`);
  }
  if (payload.filters.categoryLabel) {
    filterParts.push(payload.filters.categoryLabel);
  }
  const filterSummary = filterParts.length > 0 ? filterParts.join(" · ") : "Catalogue complet";
  const printedAtLabel = generated.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="catalog-print" lang="fr" aria-label="Liste générale des produits">
      <header className="catalog-print__mast">
        <div className="catalog-print__brand">
          <img src={EYANO_LOGO_SRC} alt={EYANO_LOGO_ALT} className="catalog-print__logo" width={140} height={36} />
        </div>
        <div className="catalog-print__edition">
          <p className="catalog-print__edition-count">{payload.items.length}</p>
          <p className="catalog-print__edition-label">
            produit{payload.items.length > 1 ? "s" : ""} imprimé{payload.items.length > 1 ? "s" : ""}
          </p>
          <p className="catalog-print__edition-date" title="Date et heure d'impression">
            {printedAtLabel}
          </p>
        </div>
      </header>

      <section className="catalog-print__report-title" aria-label="Titre du rapport">
        <h1>LISTE GENERALE DES PRODUITS</h1>
        {filterSummary !== "Catalogue complet" ? <p className="catalog-print__scope">{filterSummary}</p> : null}
      </section>

      <div className="catalog-print__table-wrap">
        <table className="catalog-print__table">
          <colgroup>
            <col className="catalog-print__col-ref" />
            <col className="catalog-print__col-name" />
            <col className="catalog-print__col-cat" />
            <col className="catalog-print__col-money" />
            <col className="catalog-print__col-money" />
            <col className="catalog-print__col-qty" />
            <col className="catalog-print__col-status" />
            <col className="catalog-print__col-code" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Référence</th>
              <th scope="col">Désignation</th>
              <th scope="col">Catégorie</th>
              <th scope="col" className="catalog-print__num">
                Prix d&apos;achat
              </th>
              <th scope="col" className="catalog-print__num">
                Prix de vente
              </th>
              <th scope="col" className="catalog-print__num catalog-print__num--center">
                Stock
              </th>
              <th scope="col">Statut</th>
              <th scope="col">Code-barres</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((product) => {
              const origin = [product.brand, product.originCountry].filter(Boolean).join(" · ");
              return (
                <tr key={product.id}>
                  <td className="catalog-print__ref">{product.reference}</td>
                  <td className="catalog-print__cell-name">
                    <span className="catalog-print__name">{product.name}</span>
                    {origin ? <span className="catalog-print__sub">{origin}</span> : null}
                  </td>
                  <td className="catalog-print__cell-category">
                    {categoryPath(product.category.parentName, product.category.name)}
                  </td>
                  <td className="catalog-print__num">{formatUsd(product.purchasePrice)}</td>
                  <td className="catalog-print__num catalog-print__num--strong">
                    {formatUsd(product.finalPrice)}
                    {product.discountPercent > 0 ? (
                      <span className="catalog-print__sub catalog-print__sub--inline">
                        −{formatPercent(product.discountPercent)}
                      </span>
                    ) : null}
                  </td>
                  <td className="catalog-print__num catalog-print__num--center">{product.warehouseStock}</td>
                  <td className="catalog-print__cell-status">
                    <span className={`catalog-print__pill catalog-print__pill--${product.status.toLowerCase()}`}>
                      {productStatusLabel(product.status)}
                    </span>
                  </td>
                  <td className="catalog-print__code">{product.barcode?.code ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="catalog-print__running-foot" aria-hidden="true">
        <span className="catalog-print__running-foot-brand">
          <img src={EYANO_LOGO_SRC} alt="" className="catalog-print__running-foot-logo" width={72} height={18} />
          Eyano
        </span>
        <span className="catalog-print__running-foot-meta">Document interne · {printedAtLabel}</span>
        <span className="catalog-print__running-foot-scope">
          {filterSummary} · {payload.items.length} / {payload.total}
        </span>
      </footer>
    </article>
  );
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} %`;
}