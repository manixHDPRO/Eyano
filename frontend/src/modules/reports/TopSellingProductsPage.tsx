import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { ghostLinkClassName, linkButtonClassName } from "../../components/ui/Button";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchReportsTopProducts } from "../../lib/api/reports";
import { fetchStores } from "../../lib/api/stores";
import { hasPermission } from "../../lib/auth/permissions";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { useAuth } from "../auth/AuthProvider";
import { formatUsd } from "../catalog/money";
import {
  REPORTS_PERIOD_OPTIONS,
  computeReportsRange,
  formatReportGeneratedAt,
  formatReportsPeriodLabel,
  type ReportsPeriodPreset,
} from "./reports-display";
import { TopSellingProductsPrint } from "./TopSellingProductsPrint";
import { buildTopSellingPrintPayload } from "./top-selling-print-data";

export function TopSellingProductsPage() {
  const { user } = useAuth();
  const canStores = hasPermission(user, "stores.manage");
  const [period, setPeriod] = useState<ReportsPeriodPreset>("30d");
  const [storeId, setStoreId] = useState("");
  const [printPayload, setPrintPayload] = useState<ReturnType<typeof buildTopSellingPrintPayload> | null>(null);

  const range = useMemo(() => computeReportsRange(period), [period]);
  const periodLabel = formatReportsPeriodLabel(period);

  const storesQuery = useQuery({
    queryKey: ["stores-top-selling-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
    enabled: canStores,
  });

  const storeOptions = useMemo(() => {
    if (canStores) {
      return storesQuery.data?.items ?? [];
    }
    return user?.stores ?? [];
  }, [canStores, storesQuery.data?.items, user?.stores]);

  useEffect(() => {
    if (!storeId && storeOptions.length === 1) {
      setStoreId(storeOptions[0]!.id);
    }
  }, [storeId, storeOptions]);

  const reportQuery = useQuery({
    queryKey: ["reports-top-products", storeId, range.from, range.to],
    queryFn: () =>
      fetchReportsTopProducts({
        storeId,
        from: range.from,
        to: range.to,
        limit: 100,
      }),
    enabled: Boolean(storeId),
  });

  const items = reportQuery.data?.items ?? [];
  const { page, setPage, slice, totalPages, totalItems } = useClientPagination(items, 20);

  const errorMessage = reportQuery.isError
    ? formatApiErrorMessage(reportQuery.error, "Impossible de charger le classement.")
    : null;

  function handlePrint() {
    if (!reportQuery.data) {
      return;
    }
    setPrintPayload(buildTopSellingPrintPayload(reportQuery.data, periodLabel));
  }

  return (
    <div className="space-y-6">
      {printPayload ? (
        <TopSellingProductsPrint payload={printPayload} onPrinted={() => setPrintPayload(null)} />
      ) : null}

      <PageHeader
        eyebrow="Rapports"
        title="Top ventes par quantité"
        description="Classement des articles les plus vendus pour une boutique, sur la période choisie."
        actions={
          <Link to="/admin/reports" className={ghostLinkClassName}>
            Synthèse rapports
          </Link>
        }
      />

      <h1 className="sr-only">Top ventes par quantité — boutique</h1>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className={filterLabelClassName} htmlFor="top-selling-period">
            Période
          </label>
          <select
            id="top-selling-period"
            className={filterInputClassName}
            value={period}
            onChange={(event) => setPeriod(event.target.value as ReportsPeriodPreset)}
          >
            {REPORTS_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={filterLabelClassName} htmlFor="top-selling-store">
            Boutique <span className="text-red-600">*</span>
          </label>
          <select
            id="top-selling-store"
            className={filterInputClassName}
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            required
          >
            <option value="">— Sélectionner —</option>
            {storeOptions.map((store) => (
              <option key={store.id} value={store.id}>
                {store.code} — {store.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={linkButtonClassName}
          disabled={!reportQuery.data || items.length === 0}
          onClick={handlePrint}
        >
          Imprimer le classement
        </button>
        {reportQuery.data ? (
          <p className="ml-auto text-xs text-slate-500">
            {periodLabel} · Généré le {formatReportGeneratedAt(reportQuery.data.generatedAt)}
          </p>
        ) : null}
      </div>

      {!storeId ? (
        <Alert tone="info">Choisissez une boutique pour afficher le classement des ventes.</Alert>
      ) : null}

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {storeId && reportQuery.isLoading ? (
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : null}

      {storeId && reportQuery.data ? (
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-900">
              {reportQuery.data.store.code} — {reportQuery.data.store.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {items.length.toLocaleString("fr-FR")} produit{items.length > 1 ? "s" : ""} ·{" "}
              {reportQuery.data.totalQtySold.toLocaleString("fr-FR")} unités vendues · CA{" "}
              {formatUsd(reportQuery.data.totalRevenueUsd)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="w-12 px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Référence</th>
                  <th className="px-4 py-2.5 font-medium">Produit</th>
                  <th className="px-4 py-2.5 font-medium text-right">Qté vendue</th>
                  <th className="px-4 py-2.5 font-medium text-right">CA USD</th>
                  <th className="px-4 py-2.5 font-medium text-right">Marge USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Aucune vente enregistrée sur cette période pour cette boutique.
                    </td>
                  </tr>
                ) : (
                  slice.map((row, index) => (
                    <tr key={row.productId}>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500">
                        {(page - 1) * 20 + index + 1}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">{row.reference}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-base font-semibold tabular-nums text-slate-900">
                        {row.qtySold.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatUsd(row.revenueUsd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-800">
                        {formatUsd(row.marginUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {items.length > 0 ? (
            <div className="border-t border-slate-200 px-5 py-3">
              <Pagination page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} itemLabel="produits" />
            </div>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}