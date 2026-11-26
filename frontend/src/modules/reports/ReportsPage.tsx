import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName, linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  downloadReportsOverviewPdf,
  downloadReportsSalesExcel,
  downloadReportsStocksExcel,
  fetchReportsOverview,
  type ReportsOverview,
  type ReportsOverviewParams,
} from "../../lib/api/reports";
import { fetchStores } from "../../lib/api/stores";
import type { PaymentMethod } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { LIVE_SYNC_STALE_TIME_MS } from "../../lib/query/live-sync";
import { formatCdfPerUsd } from "../../lib/money/exchange-rate-defaults";
import { downloadCsv } from "../../lib/export/download-csv";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../auth/AuthProvider";
import { transferStatusLabel } from "../transfers/transfer-status";
import type { TransferStatus } from "../../lib/api/types";
import { formatCdf, formatUsd } from "../catalog/money";
import { PAYMENT_METHOD_LABELS } from "../pos/pos-payments";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { ReportsCatalogSection } from "./ReportsCatalogSection";
import {
  REPORTS_PERIOD_OPTIONS,
  computeReportsRange,
  formatReportGeneratedAt,
  formatReportsPeriodLabel,
  type ReportsPeriodPreset,
} from "./reports-display";

export function ReportsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [period, setPeriod] = useState<ReportsPeriodPreset>("30d");
  const [storeId, setStoreId] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [exportPending, setExportPending] = useState<"sales" | "stocks" | "pdf" | null>(null);

  const canStores = hasPermission(user, "stores.manage");
  const range = useMemo(() => computeReportsRange(period), [period]);

  const storesQuery = useQuery({
    queryKey: ["stores-reports-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
    enabled: canStores,
  });

  const overviewQuery = useQuery({
    queryKey: ["reports-overview", storeId, range.from, range.to],
    queryFn: () =>
      fetchReportsOverview({
        storeId: storeId || undefined,
        from: range.from,
        to: range.to,
      }),
    staleTime: LIVE_SYNC_STALE_TIME_MS,
  });

  const storeOptions = useMemo(() => {
    if (canStores) {
      return storesQuery.data?.items ?? [];
    }
    return user?.stores ?? [];
  }, [canStores, storesQuery.data?.items, user?.stores]);

  const exportParams: ReportsOverviewParams = {
    storeId: storeId || undefined,
    from: range.from,
    to: range.to,
  };

  async function runExport(kind: "sales" | "stocks" | "pdf", action: () => Promise<void>) {
    setExportPending(kind);
    try {
      await action();
    } catch (caught) {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Export impossible."),
      });
    } finally {
      setExportPending(null);
    }
  }

  const data = overviewQuery.data;
  const errorMessage = overviewQuery.isError
    ? formatApiErrorMessage(overviewQuery.error, "Impossible de charger les rapports.")
    : null;

  const filteredStock = useMemo(() => {
    if (!data?.stock) {
      return [];
    }
    const q = stockSearch.trim().toLowerCase();
    if (!q) {
      return data.stock.rows;
    }
    return data.stock.rows.filter(
      (row) => row.reference.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
    );
  }, [data?.stock, stockSearch]);

  const {
    page: stockPage,
    setPage: setStockPage,
    slice: pagedStockRows,
    totalPages: stockTotalPages,
    totalItems: stockTotalItems,
  } = useClientPagination(filteredStock, 20);

  useEffect(() => {
    setStockPage(1);
  }, [stockSearch, setStockPage]);

  const topProducts = data?.topProducts ?? [];
  const {
    page: topProductsPage,
    setPage: setTopProductsPage,
    slice: pagedTopProducts,
    totalPages: topProductsTotalPages,
    totalItems: topProductsTotalItems,
  } = useClientPagination(topProducts, 15);

  const cashVariances = data?.cashVariances ?? [];
  const {
    page: cashVariancePage,
    setPage: setCashVariancePage,
    slice: pagedCashVariances,
    totalPages: cashVarianceTotalPages,
    totalItems: cashVarianceTotalItems,
  } = useClientPagination(cashVariances, 15);

  return (
    <div className="reports-print-root mx-auto w-full max-w-[1440px] space-y-8">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Comptabilité"
          title="Rapport & Exports"
          description="Synthèses commerciales, valorisation des stocks et écarts de caisse. Les chiffres respectent votre périmètre boutique et la période sélectionnée."
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={ghostLinkClassName}
                onClick={() => overviewQuery.refetch()}
                disabled={overviewQuery.isFetching}
              >
                {overviewQuery.isFetching ? "Actualisation…" : "Actualiser"}
              </button>
              <button
                type="button"
                className={ghostLinkClassName}
                disabled={!data || exportPending !== null}
                onClick={() => void runExport("sales", () => downloadReportsSalesExcel(exportParams))}
              >
                {exportPending === "sales" ? "Excel…" : "Excel ventes"}
              </button>
              <button
                type="button"
                className={ghostLinkClassName}
                disabled={!data?.stock || exportPending !== null}
                onClick={() => void runExport("stocks", () => downloadReportsStocksExcel(exportParams))}
              >
                {exportPending === "stocks" ? "Excel…" : "Excel stocks"}
              </button>
              <button
                type="button"
                className={ghostLinkClassName}
                disabled={!data || exportPending !== null}
                onClick={() => void runExport("pdf", () => downloadReportsOverviewPdf(exportParams))}
              >
                {exportPending === "pdf" ? "PDF…" : "PDF synthèse"}
              </button>
              <button
                type="button"
                className={ghostLinkClassName}
                disabled={!data}
                onClick={() => data && exportSalesCsv(data)}
              >
                CSV ventes
              </button>
              <button
                type="button"
                className={ghostLinkClassName}
                disabled={!data?.stock}
                onClick={() => data?.stock && exportStockCsv(data)}
              >
                CSV stocks
              </button>
              <button type="button" className={linkButtonClassName} disabled={!data} onClick={() => window.print()}>
                Imprimer
              </button>
            </div>
          }
        />

        <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className={filterLabelClassName} htmlFor="reports-period">
              Période
            </label>
            <select
              id="reports-period"
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
          {storeOptions.length > 0 ? (
            <div>
              <label className={filterLabelClassName} htmlFor="reports-store">
                Boutique
              </label>
              <select
                id="reports-store"
                className={filterInputClassName}
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
              >
                <option value="">{canStores ? "Toutes les boutiques" : "Ma boutique"}</option>
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} — {store.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {data ? (
            <div className="ml-auto text-right text-xs text-slate-500">
              <p>
                Période : <span className="font-medium text-slate-700">{formatReportsPeriodLabel(period)}</span>
              </p>
              <p className="mt-0.5">Généré le {formatReportGeneratedAt(data.generatedAt)}</p>
            </div>
          ) : null}
        </div>
      </div>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {overviewQuery.isLoading ? <ReportsSkeleton /> : null}

      {data ? (
        <>
          <div className="mb-4 hidden text-sm text-slate-700 print:block">
            <p className="font-semibold">Eyano — Rapport & Exports</p>
            <p>
              {formatReportsPeriodLabel(period)} · {formatReportGeneratedAt(data.generatedAt)}
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Chiffre d’affaires net"
              value={formatUsd(data.financialSummary.revenueUsd)}
              hint={`${data.financialSummary.salesCount} vente(s) · Remises ${formatUsd(data.financialSummary.discountsUsd)}`}
            />
            <KpiCard
              label="Marge brute"
              value={formatUsd(data.financialSummary.grossMarginUsd)}
              hint={`Coût d’achat vendu ${formatUsd(data.financialSummary.costUsd)}`}
              emphasize
            />
            <KpiCard
              label="Résultat net"
              value={formatUsd(data.financialSummary.netResultUsd)}
              hint={`Dépenses ${formatUsd(data.financialSummary.expensesUsd)}`}
            />
            <KpiCard
              label="Encaissements"
              value={formatUsd(data.financialSummary.collectionsByCurrency.usd)}
              hint={`CDF collectés ${formatCdf(data.financialSummary.collectionsByCurrency.cdf)}`}
            />
          </section>

          {data.exchangeRates.encaissementRate || data.exchangeRates.decaissementRate ? (
            <p className="text-xs text-slate-500">
              Taux actifs — encaissement{" "}
              <span className="font-mono font-medium text-slate-700">
                {data.exchangeRates.encaissementRate ? `${formatCdfPerUsd(data.exchangeRates.encaissementRate)} CDF` : "—"}
              </span>
              {" · "}
              décaissement{" "}
              <span className="font-mono font-medium text-slate-700">
                {data.exchangeRates.decaissementRate ? `${formatCdfPerUsd(data.exchangeRates.decaissementRate)} CDF` : "—"}
              </span>
              . Les dépenses CDF sont converties au taux décaissement.
            </p>
          ) : null}

          {data.activeTransfers ? (
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Transferts en cours</h2>
                <Link to="/admin/transfers" className={ghostLinkClassName}>
                  Voir tous les transferts
                </Link>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.activeTransfers.activeCount} dossier(s) hors états reçus ou annulés.
              </p>
              {data.activeTransfers.recent.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Aucun transfert actif sur votre périmètre.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="py-2 pr-3 font-medium">Référence</th>
                        <th className="py-2 pr-3 font-medium">Boutique</th>
                        <th className="py-2 pr-3 font-medium">Statut</th>
                        <th className="py-2 font-medium">Créé le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activeTransfers.recent.map((transfer) => (
                        <tr key={transfer.id} className="border-b border-slate-50 text-slate-700">
                          <td className="py-2.5 pr-3 font-mono font-medium text-slate-900">
                            <Link to={`/admin/transfers/${transfer.id}`} className="hover:underline">
                              {transfer.reference}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-3">{transfer.storeName}</td>
                          <td className="py-2.5 pr-3">
                            <StatusBadge
                              label={transferStatusLabel(transfer.status as TransferStatus)}
                              tone="neutral"
                            />
                          </td>
                          <td className="py-2.5 tabular-nums text-slate-500">
                            {formatReportGeneratedAt(transfer.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-12">
            <article className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Ventes et dépenses par boutique (USD)</h2>
              <div className="mt-4 h-72">
                {data.byStore.length === 0 ? (
                  <EmptyChart message="Aucune donnée sur la période." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byStore} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip
                        formatter={(value) => formatUsd(Number(value ?? 0))}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenueUsd" name="CA USD" fill="#0f172a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expensesUsd" name="Dépenses USD" fill="#d97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Encaissements par moyen</h2>
              <ul className="mt-4 divide-y divide-slate-100">
                {paymentMethodRows(data).length === 0 ? (
                  <li className="py-8 text-center text-sm text-slate-500">Aucun paiement sur la période.</li>
                ) : (
                  paymentMethodRows(data).map((row) => (
                    <li key={row.method} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{row.label}</p>
                        <p className="text-xs text-slate-500">{row.count} ligne(s)</p>
                      </div>
                      <p className="font-mono font-semibold tabular-nums text-slate-900">{formatUsd(row.totalUsd)}</p>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-900">Top produits (CA)</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                <Link to="/admin/reports/top-selling" className="text-slate-600 hover:text-slate-900">
                  Top ventes par quantité (boutique) →
                </Link>
                <Link to="/admin/sales" className="text-slate-600 hover:text-slate-900">
                  Voir toutes les ventes →
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Référence</th>
                    <th className="px-4 py-2.5 font-medium">Produit</th>
                    <th className="px-4 py-2.5 font-medium text-right">Qté</th>
                    <th className="px-4 py-2.5 font-medium text-right">CA USD</th>
                    <th className="px-4 py-2.5 font-medium text-right">Marge USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        Aucune vente produit sur la période.
                      </td>
                    </tr>
                  ) : (
                    pagedTopProducts.map((row) => (
                      <tr key={row.productId}>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{row.reference}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.qtySold}</td>
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
            {topProducts.length > 0 ? (
              <div className="border-t border-slate-200 px-5 py-3 print:hidden">
                <Pagination
                  page={topProductsPage}
                  totalPages={topProductsTotalPages}
                  totalItems={topProductsTotalItems}
                  onPageChange={setTopProductsPage}
                  itemLabel="produits"
                />
              </div>
            ) : null}
          </article>

          {data.stock ? (
            <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Valorisation des stocks</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatUsd(data.stock.totalValuationUsd)} · {data.stock.totalUnits.toLocaleString("fr-FR")} unités
                    {data.stock.truncated ? " · export limité aux 300 premiers articles" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <input
                    type="search"
                    placeholder="Rechercher…"
                    value={stockSearch}
                    onChange={(event) => setStockSearch(event.target.value)}
                    className={filterInputClassName}
                  />
                  <Link to="/admin/stock" className={ghostLinkClassName}>
                    Détail stock
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-4 py-2.5 font-medium">Référence</th>
                      <th className="px-4 py-2.5 font-medium">Produit</th>
                      {data.stock.showWarehouse ? (
                        <th className="px-4 py-2.5 font-medium text-right">Entrepôt</th>
                      ) : null}
                      <th className="px-4 py-2.5 font-medium text-right">Boutiques</th>
                      <th className="px-4 py-2.5 font-medium text-right">Total</th>
                      <th className="px-4 py-2.5 font-medium text-right">Valorisation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStock.length === 0 ? (
                      <tr>
                        <td colSpan={data.stock.showWarehouse ? 6 : 5} className="px-4 py-10 text-center text-slate-500">
                          Aucun article à afficher.
                        </td>
                      </tr>
                    ) : (
                      pagedStockRows.map((row) => (
                        <tr key={row.productId}>
                          <td className="px-4 py-2.5 font-mono text-slate-600">{row.reference}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
                          {data.stock!.showWarehouse ? (
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.warehouseQty}</td>
                          ) : null}
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.storesQty}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{row.totalQty}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatUsd(row.valuationUsd)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredStock.length > 0 ? (
                <div className="border-t border-slate-200 px-5 py-3 print:hidden">
                  <Pagination
                    page={stockPage}
                    totalPages={stockTotalPages}
                    totalItems={stockTotalItems}
                    onPageChange={setStockPage}
                    itemLabel="articles"
                  />
                </div>
              ) : null}
            </article>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-base font-semibold text-slate-900">Écarts de clôture caisse</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-4 py-2.5 font-medium">Boutique</th>
                      <th className="px-4 py-2.5 font-medium">Caisse</th>
                      <th className="px-4 py-2.5 font-medium">Clôture</th>
                      <th className="px-4 py-2.5 font-medium text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashVariances.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                          Aucune session clôturée sur la période.
                        </td>
                      </tr>
                    ) : (
                      pagedCashVariances.map((row) => (
                        <tr key={row.sessionId}>
                          <td className="px-4 py-2.5 text-slate-800">{row.storeName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{row.registerLabel}</td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                              new Date(row.closedAt),
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                            <VarianceBadge usd={row.varianceUsd} cdf={row.varianceCdf} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {cashVariances.length > 0 ? (
                <div className="border-t border-slate-200 px-5 py-3 print:hidden">
                  <Pagination
                    page={cashVariancePage}
                    totalPages={cashVarianceTotalPages}
                    totalItems={cashVarianceTotalItems}
                    onPageChange={setCashVariancePage}
                    itemLabel="écarts"
                  />
                </div>
              ) : null}
              <div className="border-t border-slate-100 px-5 py-2.5">
                <Link to="/admin/cash-sessions" className="text-xs font-medium text-slate-600 hover:text-slate-900">
                  Sessions de caisse →
                </Link>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-base font-semibold text-slate-900">Dernières ventes (période)</h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {data.recentSales.length === 0 ? (
                  <li className="px-5 py-10 text-center text-sm text-slate-500">Aucune vente récente.</li>
                ) : (
                  data.recentSales.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <Link
                          to={`/admin/sales/${row.id}`}
                          className="font-mono font-semibold text-slate-900 hover:underline"
                        >
                          {row.saleNumber}
                        </Link>
                        <p className="truncate text-xs text-slate-500">{row.storeName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono font-semibold tabular-nums text-slate-900">{formatUsd(row.totalUsd)}</p>
                        <p className="text-[11px] text-slate-500">
                          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                            new Date(row.completedAt),
                          )}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>

          {user ? <ReportsCatalogSection user={user} /> : null}
        </>
      ) : null}
    </div>
  );
}

function paymentMethodRows(data: ReportsOverview) {
  const entries = Object.entries(data.financialSummary.collectionsByMethod) as Array<
    [PaymentMethod, { count: number; totalUsd: number }]
  >;
  return entries
    .map(([method, stats]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method] ?? method,
      count: stats.count,
      totalUsd: stats.totalUsd,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

function exportSalesCsv(data: ReportsOverview) {
  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(
    `eyano-ventes-${date}.csv`,
    ["Code boutique", "Boutique", "Nombre ventes", "CA USD", "Dépenses USD"],
    data.byStore.map((row) => [row.code, row.name, row.salesCount, row.revenueUsd, row.expensesUsd]),
  );
}

function exportStockCsv(data: ReportsOverview) {
  if (!data.stock) {
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const headers = data.stock.showWarehouse
    ? ["Référence", "Désignation", "Entrepôt", "Boutiques", "Total", "Valorisation USD"]
    : ["Référence", "Désignation", "Boutiques", "Total", "Valorisation USD"];
  const rows = data.stock.rows.map((row) =>
    data.stock!.showWarehouse
      ? [row.reference, row.name, row.warehouseQty, row.storesQty, row.totalQty, row.valuationUsd]
      : [row.reference, row.name, row.storesQty, row.totalQty, row.valuationUsd],
  );
  downloadCsv(`eyano-stocks-${date}.csv`, headers, rows);
}

function KpiCard({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight ${
          emphasize ? "text-emerald-800" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
    </article>
  );
}

function VarianceBadge({ usd, cdf }: { usd: number; cdf: number }) {
  const hasGap = Math.abs(usd) > 0.01 || Math.abs(cdf) > 0;
  if (!hasGap) {
    return <StatusBadge label="Conforme" tone="success" compact />;
  }
  const tone = usd < 0 || cdf < 0 ? "danger" : "warning";
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <StatusBadge label={formatUsd(usd)} tone={tone} compact />
      <span className="text-[11px] font-mono text-slate-500">{formatCdf(cdf)}</span>
    </span>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
  );
}