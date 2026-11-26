import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchSales, fetchSalesSummary } from "../../lib/api/sales";
import { fetchStores } from "../../lib/api/stores";
import type { SaleListItem } from "../../lib/api/types";
import { formatUsd } from "../catalog/money";
import {
  completedAtRangeFromDateInputs,
  formatSaleDayLabel,
  formatSaleTimeLabel,
  saleLocalDayKey,
  todayDateInputValue,
} from "./sale-date-range";
import { formatSaleCollected, formatSalePaymentLabel } from "./sale-list-display";
import { saleStatusLabel, saleStatusTone } from "./sale-status";

const PAGE_SIZE = 20;

type JournalRow =
  | { kind: "day"; key: string; label: string }
  | { kind: "sale"; sale: SaleListItem };

export function SalesListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [dateFrom, setDateFrom] = useState(todayDateInputValue);
  const [dateTo, setDateTo] = useState(todayDateInputValue);

  const completedRange = useMemo(
    () => completedAtRangeFromDateInputs(dateFrom, dateTo),
    [dateFrom, dateTo],
  );
  const dateRangeError = completedRange.error ?? null;

  const storesQuery = useQuery({
    queryKey: ["stores-sales-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100, status: "ACTIVE" }),
  });

  const summaryQuery = useQuery({
    queryKey: ["sales-summary"],
    queryFn: fetchSalesSummary,
  });

  const listQuery = useQuery({
    queryKey: ["sales", page, status, search, storeId, dateFrom, dateTo],
    queryFn: () =>
      fetchSales({
        page,
        pageSize: PAGE_SIZE,
        storeId: storeId || undefined,
        status: status === "COMPLETED" || status === "VOIDED" ? status : undefined,
        search: search.trim() || undefined,
        completedFrom: completedRange.completedFrom,
        completedTo: completedRange.completedTo,
      }),
    enabled: !dateRangeError,
  });

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;
  const storeOptions = storesQuery.data?.items ?? [];

  const journalRows = useMemo(() => buildJournalRows(items), [items]);

  const periodHint =
    dateFrom || dateTo
      ? `Période affichée : ${dateFrom ? formatInputDateLabel(dateFrom) : "…"} → ${dateTo ? formatInputDateLabel(dateTo) : "…"}`
      : null;

  return (
    <div className="space-y-6">
      <Outlet />
      <PageHeader
        eyebrow="Ventes & caisse"
        title="Historique des ventes"
        description="Toutes les ventes enregistrées (toutes sessions et boutiques selon votre périmètre). Filtrez par boutique, période ou statut. La caisse du jour se fait sur /pos."
        actions={
          <Link to="/pos" className={linkButtonClassName}>
            Ouvrir la caisse
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Aujourd’hui" value={`${summary?.todayCount ?? "—"} vente(s)`} hint={`${(summary?.todayTotalUsd ?? 0).toFixed(2)} USD`} />
        <Kpi label="CA jour (USD)" value={(summary?.todayTotalUsd ?? 0).toFixed(2)} hint="Ventes complétées" />
        <Kpi label="Annulées (toutes)" value={String(summary?.voidedCount ?? "—")} hint="Statut VOIDED" accent />
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {dateRangeError ? <Alert tone="error">{dateRangeError}</Alert> : null}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Journal des ventes</h2>
          {periodHint ? <p className="text-xs text-slate-500">{periodHint}</p> : null}
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="min-w-[12rem] flex-1">
            <span className={filterLabelClassName}>N° vente</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="VE000123…"
              className={`${filterInputClassName} mt-1`}
            />
          </label>
          <label className="min-w-[9.5rem]">
            <span className={filterLabelClassName}>Du</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className={`${filterInputClassName} mt-1`}
            />
          </label>
          <label className="min-w-[9.5rem]">
            <span className={filterLabelClassName}>Au</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              className={`${filterInputClassName} mt-1`}
            />
          </label>
          <label className="min-w-[12rem]">
            <span className={filterLabelClassName}>Boutique</span>
            <select
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                setPage(1);
              }}
              className={`${filterInputClassName} mt-1`}
            >
              <option value="">Toutes les boutiques</option>
              {storeOptions.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code} — {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[10rem]">
            <span className={filterLabelClassName}>Statut</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={`${filterInputClassName} mt-1`}
            >
              <option value="">Toutes</option>
              <option value="COMPLETED">Validées</option>
              <option value="VOIDED">Annulées</option>
            </select>
          </label>
        </div>

        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Ventes groupées par jour calendaire
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">N° ticket</th>
                <th className="px-4 py-3 font-medium">Jour</th>
                <th className="px-4 py-3 font-medium">Heure</th>
                <th className="px-4 py-3 font-medium">Boutique</th>
                <th className="px-4 py-3 font-medium">Caissier</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 text-right font-medium">Total USD</th>
                <th className="px-4 py-3 text-right font-medium">Encaissé</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Chargement…
                  </td>
                </tr>
              ) : journalRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Aucune vente pour ces filtres.
                  </td>
                </tr>
              ) : (
                journalRows.map((row) =>
                  row.kind === "day" ? (
                    <tr key={`day-${row.key}`} className="border-y border-slate-200 bg-slate-100/80">
                      <td colSpan={10} className="px-4 py-2.5 text-xs font-semibold tracking-tight text-slate-800">
                        {row.label}
                      </td>
                    </tr>
                  ) : (
                    <SaleJournalRow key={row.sale.id} sale={row.sale} />
                  ),
                )
              )}
            </tbody>
          </table>
        </div>

        {listQuery.data ? (
          <Pagination
            page={listQuery.data.page}
            totalPages={listQuery.data.totalPages}
            totalItems={listQuery.data.total}
            onPageChange={setPage}
            itemLabel="ventes"
          />
        ) : null}
      </section>
    </div>
  );
}

function SaleJournalRow({ sale }: { sale: SaleListItem }) {
  const dayShort = new Date(sale.completedAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link to={`/admin/sales/${sale.id}`} className="font-mono text-sm font-semibold text-slate-900 hover:underline">
          {sale.number}
        </Link>
      </td>
      <td className="px-4 py-3 font-medium text-slate-800">{dayShort}</td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600">{formatSaleTimeLabel(sale.completedAt)}</td>
      <td className="px-4 py-3 text-slate-700">
        {sale.store.code}
        <span className="text-slate-500"> · {sale.store.name}</span>
      </td>
      <td className="px-4 py-3 text-slate-700">{sale.cashierName}</td>
      <td className="px-4 py-3 text-slate-600">
        {formatSalePaymentLabel(sale)}
        {sale.primaryPayment?.providerReference ? ` · ${sale.primaryPayment.providerReference}` : ""}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-slate-900">{formatUsd(sale.total)}</td>
      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{formatSaleCollected(sale)}</td>
      <td className="px-4 py-3">
        <StatusBadge label={saleStatusLabel(sale.status)} tone={saleStatusTone(sale.status)} />
      </td>
      <td className="px-4 py-3 text-right">
        <Link to={`/admin/sales/${sale.id}`} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
          Détail
        </Link>
      </td>
    </tr>
  );
}

function buildJournalRows(items: SaleListItem[]): JournalRow[] {
  const rows: JournalRow[] = [];
  let lastDayKey = "";
  for (const sale of items) {
    const dayKey = saleLocalDayKey(sale.completedAt);
    if (dayKey !== lastDayKey) {
      rows.push({ kind: "day", key: dayKey, label: formatSaleDayLabel(sale.completedAt) });
      lastDayKey = dayKey;
    }
    rows.push({ kind: "sale", sale });
  }
  return rows;
}

function formatInputDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Kpi(props: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <article
      className={`rounded-2xl border p-4 ${props.accent ? "border-red-500/25 bg-red-500/5" : "border-slate-200 bg-slate-50"}`}
    >
      <p className="text-xs uppercase tracking-widest text-slate-500">{props.label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{props.value}</p>
      <p className="text-xs text-slate-500">{props.hint}</p>
    </article>
  );
}