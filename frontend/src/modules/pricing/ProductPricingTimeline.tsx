import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchProductPricingTimeline } from "../../lib/api/pricing";
import type { PricingHistoryDiscountRow, PricingHistoryPriceRow, ProductStatus } from "../../lib/api/types";
import { formatUsd } from "../catalog/money";
import { productStatusLabel, productStatusTone } from "../catalog/product-status";
import {
  formatDiscountSnapshot,
  formatPriceSnapshot,
  HistoryMeta,
  HistoryPeriodCard,
  PeriodSnapshotValues,
} from "./pricing-history-display";

type ProductPricingTimelineProps = {
  productId: string;
  compact?: boolean;
};

export function ProductPricingTimelinePanel({ productId, compact = false }: ProductPricingTimelineProps) {
  const timelineQuery = useQuery({
    queryKey: ["pricing-timeline", productId],
    queryFn: () => fetchProductPricingTimeline(productId),
    enabled: Boolean(productId),
  });

  if (timelineQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
        Chargement de l’historique tarifaire…
      </div>
    );
  }

  if (timelineQuery.isError || !timelineQuery.data) {
    return (
      <Alert tone="error">{formatApiErrorMessage(timelineQuery.error, "Historique tarifaire indisponible.")}</Alert>
    );
  }

  const { product, prices, discounts } = timelineQuery.data;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Historique tarifaire</p>
          <p className="mt-1 text-sm text-slate-600">
            Le tarif actuel en haut ; chaque ligne archivée conserve les anciens prix ou remises tels qu’ils étaient.
          </p>
        </div>
        {!compact ? (
          <Link
            to="/admin/pricing"
            className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
          >
            Vue Prix & remises
          </Link>
        ) : null}
      </div>

      {!compact ? <TariffSummary product={product} /> : null}

      <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
        <PriceHistoryList rows={prices} />
        <DiscountHistoryList rows={discounts} />
      </div>
    </section>
  );
}

function PriceHistoryList({ rows }: { rows: PricingHistoryPriceRow[] }) {
  const current = rows.find((row) => row.validTo === null);
  const archived = rows.filter((row) => row.validTo !== null);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80">
      <div className="border-b border-slate-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Prix (achat / officiel)</p>
      </div>
      <ul className="max-h-[28rem] min-w-0 space-y-3 overflow-x-hidden overflow-y-auto p-3">
        {rows.length === 0 ? (
          <li className="py-4 text-center text-xs text-slate-500">Aucune ligne pour le moment.</li>
        ) : (
          <>
            {current ? (
              <HistoryPeriodCard tone="current" badge="Tarif en vigueur">
                <PeriodSnapshotValues items={formatPriceSnapshot(current.purchasePrice, current.officialPrice)} />
                <HistoryMeta
                  from={current.validFrom}
                  to={current.validTo}
                  author={current.createdByName}
                  reason={current.reason}
                />
              </HistoryPeriodCard>
            ) : null}

            {archived.length > 0 ? (
              <li className="pt-1">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Anciens prix modifiés ({archived.length})
                </p>
                <ul className="space-y-2">
                  {archived.map((row) => (
                    <HistoryPeriodCard key={row.id} tone="archived" badge="Ancien tarif">
                      <PeriodSnapshotValues items={formatPriceSnapshot(row.purchasePrice, row.officialPrice)} />
                      <HistoryMeta
                        from={row.validFrom}
                        to={row.validTo}
                        author={row.createdByName}
                        reason={row.reason}
                      />
                    </HistoryPeriodCard>
                  ))}
                </ul>
              </li>
            ) : null}
          </>
        )}
      </ul>
    </div>
  );
}

function DiscountHistoryList({ rows }: { rows: PricingHistoryDiscountRow[] }) {
  const current = rows.find((row) => row.validTo === null);
  const archived = rows.filter((row) => row.validTo !== null);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80">
      <div className="border-b border-slate-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Remises</p>
      </div>
      <ul className="max-h-[28rem] min-w-0 space-y-3 overflow-x-hidden overflow-y-auto p-3">
        {rows.length === 0 ? (
          <li className="py-4 text-center text-xs text-slate-500">Aucune ligne pour le moment.</li>
        ) : (
          <>
            {current ? (
              <HistoryPeriodCard tone="current" badge="Remise en vigueur">
                <PeriodSnapshotValues items={formatDiscountSnapshot(current.percent)} />
                <HistoryMeta
                  from={current.validFrom}
                  to={current.validTo}
                  author={current.createdByName}
                  reason={current.reason}
                />
              </HistoryPeriodCard>
            ) : null}

            {archived.length > 0 ? (
              <li className="pt-1">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Anciennes remises modifiées ({archived.length})
                </p>
                <ul className="space-y-2">
                  {archived.map((row) => (
                    <HistoryPeriodCard key={row.id} tone="archived" badge="Ancienne remise">
                      <PeriodSnapshotValues items={formatDiscountSnapshot(row.percent)} />
                      <HistoryMeta
                        from={row.validFrom}
                        to={row.validTo}
                        author={row.createdByName}
                        reason={row.reason}
                      />
                    </HistoryPeriodCard>
                  ))}
                </ul>
              </li>
            ) : null}
          </>
        )}
      </ul>
    </div>
  );
}

function TariffSummary({
  product,
}: {
  product: {
    reference: string;
    name: string;
    status: ProductStatus;
    finalPrice: number;
    discountPercent: number;
    officialPrice: number;
  };
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
      <StatusBadge label={productStatusLabel(product.status)} tone={productStatusTone(product.status)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {product.reference} — {product.name}
        </p>
        <p className="text-xs text-slate-500">
          Officiel {formatUsd(product.officialPrice)}
          {product.discountPercent > 0 ? ` · remise ${product.discountPercent} %` : ""}
        </p>
      </div>
      <p className="text-lg font-semibold tabular-nums text-slate-600">
        {formatUsd(product.finalPrice)}
      </p>
    </div>
  );
}

export function PricingFormulaHint({ children }: { children?: ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-slate-500">
      {children ??
        "Prix final = arrondi half-up du prix officiel après remise (%). Le total caisse multipliera ce prix unitaire déjà arrondi."}
    </p>
  );
}