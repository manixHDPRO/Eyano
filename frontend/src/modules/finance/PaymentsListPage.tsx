import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName, linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { inputClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchPayments, fetchPaymentsSummary } from "../../lib/api/payments";
import { fetchStores } from "../../lib/api/stores";
import type { PaymentListItem, PaymentMethod } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { formatCdf, formatUsd } from "../catalog/money";
import { PAYMENT_METHOD_LABELS } from "../pos/pos-payments";
import { saleStatusLabel, saleStatusTone } from "../sales/sale-status";

type PeriodPreset = "today" | "7d" | "30d" | "all";

export function PaymentsListPage() {
  const { user } = useAuth();
  const canSeeSales = hasPermission(user, "reports.read") || hasPermission(user, "sales.create");
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [currency, setCurrency] = useState<"USD" | "CDF" | "">("");
  const [saleStatus, setSaleStatus] = useState<"COMPLETED" | "VOIDED" | "ALL">("COMPLETED");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("today");

  const paidRange = useMemo(() => computePaidRange(period), [period]);

  const storesQuery = useQuery({
    queryKey: ["stores-payments-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
    enabled: canSeeSales,
  });

  const summaryQuery = useQuery({
    queryKey: ["payments-summary", storeId],
    queryFn: () => fetchPaymentsSummary(storeId || undefined),
  });

  const listQuery = useQuery({
    queryKey: ["payments", page, storeId, method, currency, saleStatus, search, paidRange.from, paidRange.to],
    queryFn: () =>
      fetchPayments({
        page,
        pageSize: 20,
        storeId: storeId || undefined,
        method: method || undefined,
        currency: currency || undefined,
        saleStatus,
        search: search.trim() || undefined,
        paidFrom: paidRange.from,
        paidTo: paidRange.to,
      }),
  });

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Encaissements"
        description="Registre des lignes de paiement figées (USD / CDF, taux snapshot sur chaque ligne CDF). Lecture seule — la saisie se fait sur la caisse /pos."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/exchange-rates" className={ghostLinkClassName}>
              Taux de change
            </Link>
            <Link to="/pos" className={linkButtonClassName}>
              Caisse POS
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Lignes aujourd’hui"
          value={String(summary?.todayLineCount ?? "—")}
          hint="Paiements sur ventes validées"
        />
        <Kpi
          label="Montant USD (jour)"
          value={summary ? formatUsd(summary.todayAmountUsd) : "—"}
          hint="Somme des contre-valeurs USD"
          emphasize
        />
        <Kpi
          label="Espèces · Mobile"
          value={
            summary
              ? `${formatUsd(summary.todayCashUsd)} · ${formatUsd(summary.todayMobileUsd)}`
              : "—"
          }
          hint="Répartition contre-valeur USD"
        />
        <Kpi
          label="CDF collectés (jour)"
          value={summary ? formatCdf(summary.todayCdfCollected) : "—"}
          hint="Montants bruts en francs congolais"
        />
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
            <label className="lg:col-span-3">
              <span className={filterLabelClassName}>Recherche</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="N° vente, réf. Mobile Money…"
                className={`${inputClassName} mt-1`}
              />
            </label>

            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Boutique</span>
              <select
                value={storeId}
                onChange={(event) => {
                  setStoreId(event.target.value);
                  setPage(1);
                }}
                className={`${filterInputClassName} mt-1 w-full`}
              >
                <option value="">Toutes (périmètre)</option>
                {(storesQuery.data?.items ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} — {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Moyen</span>
              <select
                value={method}
                onChange={(event) => {
                  setMethod(event.target.value as PaymentMethod | "");
                  setPage(1);
                }}
                className={`${filterInputClassName} mt-1 w-full`}
              >
                <option value="">Tous</option>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((key) => (
                  <option key={key} value={key}>
                    {PAYMENT_METHOD_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>

            <label className="lg:col-span-1">
              <span className={filterLabelClassName}>Devise</span>
              <select
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value as "USD" | "CDF" | "");
                  setPage(1);
                }}
                className={`${filterInputClassName} mt-1 w-full`}
              >
                <option value="">Toutes</option>
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
            </label>

            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Vente liée</span>
              <select
                value={saleStatus}
                onChange={(event) => {
                  setSaleStatus(event.target.value as "COMPLETED" | "VOIDED" | "ALL");
                  setPage(1);
                }}
                className={`${filterInputClassName} mt-1 w-full`}
              >
                <option value="COMPLETED">Validées uniquement</option>
                <option value="VOIDED">Annulées</option>
                <option value="ALL">Toutes ventes</option>
              </select>
            </label>

            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Période (encaissé)</span>
              <select
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as PeriodPreset);
                  setPage(1);
                }}
                className={`${filterInputClassName} mt-1 w-full`}
              >
                <option value="today">Aujourd’hui</option>
                <option value="7d">7 derniers jours</option>
                <option value="30d">30 derniers jours</option>
                <option value="all">Historique complet</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date encaissement</th>
                <th className="px-4 py-3">Vente</th>
                <th className="px-4 py-3">Boutique · caissier</th>
                <th className="px-4 py-3">Moyen</th>
                <th className="px-4 py-3 text-right">Montant encaissé</th>
                <th className="px-4 py-3 text-right">Contre-valeur USD</th>
                <th className="px-4 py-3">Taux figé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Chargement des encaissements…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Aucune ligne de paiement pour ces filtres.
                  </td>
                </tr>
              ) : (
                items.map((row) => <PaymentRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>

        {listQuery.data ? (
          <div className="border-t border-slate-200 px-4 py-3">
            <Pagination
              page={listQuery.data.page}
              totalPages={listQuery.data.totalPages}
              totalItems={listQuery.data.total}
              onPageChange={setPage}
              itemLabel="lignes"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PaymentRow({ row }: { row: PaymentListItem }) {
  const paid = new Date(row.paidAt);
  const methodTone = paymentMethodTone(row.method);

  return (
    <tr className="transition hover:bg-slate-50/80">
      <td className="px-4 py-3 align-top">
        <p className="font-mono tabular-nums text-slate-900">
          {paid.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
        <p className="font-mono text-[11px] tabular-nums text-slate-500">
          {paid.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <Link to={`/admin/sales/${row.sale.id}`} className="font-mono text-sm font-semibold text-slate-900 hover:underline">
          {row.sale.number}
        </Link>
        <span className="mt-1 inline-flex">
          <StatusBadge label={saleStatusLabel(row.sale.status)} tone={saleStatusTone(row.sale.status)} />
        </span>
        {row.providerReference ? (
          <p className="mt-1 max-w-[12rem] truncate font-mono text-[10px] text-slate-500" title={row.providerReference}>
            Réf. {row.providerReference}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-slate-700">
        <p className="font-medium">{row.store.code}</p>
        <p className="text-[11px] text-slate-500">{row.store.name}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{row.cashierName}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${methodTone}`}
        >
          {PAYMENT_METHOD_LABELS[row.method]}
        </span>
        <p className="mt-1 font-mono text-[10px] text-slate-500">{row.currency}</p>
      </td>
      <td className="px-4 py-3 align-top text-right font-mono tabular-nums text-slate-900">
        {row.currency === "USD" ? formatUsd(row.amount) : formatCdf(row.amount)}
        <span className="ml-1 text-[10px] text-slate-500">{row.currency}</span>
      </td>
      <td className="px-4 py-3 align-top text-right font-mono text-sm font-semibold tabular-nums text-slate-900">
        {formatUsd(row.amountUsd)}
      </td>
      <td className="px-4 py-3 align-top font-mono text-[11px] text-slate-600">
        {row.rateSnapshot != null ? `${row.rateSnapshot.toLocaleString("fr-FR")} CDF` : "—"}
      </td>
    </tr>
  );
}

function paymentMethodTone(method: PaymentMethod): string {
  switch (method) {
    case "CASH":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "MPESA":
      return "bg-red-50 text-red-900 ring-1 ring-red-200";
    case "ORANGE_MONEY":
      return "bg-orange-50 text-orange-900 ring-1 ring-orange-200";
    case "AIRTEL_MONEY":
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

function Kpi(props: { label: string; value: string; hint: string; emphasize?: boolean }) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        props.emphasize ? "border-slate-300 bg-slate-900 text-white" : "border-slate-200 bg-white"
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${props.emphasize ? "text-slate-400" : "text-slate-500"}`}>
        {props.label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${props.emphasize ? "text-white" : "text-slate-900"}`}>
        {props.value}
      </p>
      <p className={`text-xs ${props.emphasize ? "text-slate-400" : "text-slate-500"}`}>{props.hint}</p>
    </article>
  );
}

function computePaidRange(period: PeriodPreset): { from?: string; to?: string } {
  if (period === "all") {
    return {};
  }
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 29);
  }
  return { from: start.toISOString(), to: now.toISOString() };
}