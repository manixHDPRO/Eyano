import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName, linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { expenseSiteLabel, fetchExpenses, fetchExpensesSummary } from "../../lib/api/expenses";
import { fetchStores } from "../../lib/api/stores";
import type { ExpenseCategoryCode, ExpenseListItem, ExpenseScopeType } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { formatCdf, formatUsd } from "../catalog/money";
import { ExpenseCreateModal } from "./ExpenseCreateModal";
import { EXPENSE_CATEGORY_OPTIONS, expenseCategoryLabel } from "./expense-labels";
import { expenseStatusLabel, expenseStatusTone } from "./expense-status";

type PeriodPreset = "today" | "7d" | "30d" | "all";

export function ExpensesListPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "expenses.manage");
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState("");
  const [scopeType, setScopeType] = useState<ExpenseScopeType | "">("");
  const [currency, setCurrency] = useState<"USD" | "CDF" | "">("");
  const [category, setCategory] = useState<ExpenseCategoryCode | "">("");
  const [drawerFilter, setDrawerFilter] = useState<"" | "drawer" | "off">("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [showCreate, setShowCreate] = useState(false);

  const spentRange = useMemo(() => computeSpentRange(period), [period]);

  const storesQuery = useQuery({
    queryKey: ["stores-expenses-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
  });

  const summaryQuery = useQuery({
    queryKey: ["expenses-summary", storeId],
    queryFn: () => fetchExpensesSummary(storeId || undefined),
  });

  const listQuery = useQuery({
    queryKey: [
      "expenses",
      page,
      storeId,
      scopeType,
      currency,
      category,
      drawerFilter,
      search,
      spentRange.from,
      spentRange.to,
    ],
    queryFn: () =>
      fetchExpenses({
        page,
        pageSize: 20,
        storeId: storeId || undefined,
        scopeType: scopeType || undefined,
        currency: currency || undefined,
        category: category || undefined,
        search: search.trim() || undefined,
        spentFrom: spentRange.from,
        spentTo: spentRange.to,
        fromCashDrawer: drawerFilter === "drawer" ? true : drawerFilter === "off" ? false : undefined,
      }),
  });

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Dépenses"
        description="Journal des charges par site (boutique ou entrepôt), en USD ou CDF. Les dépenses prélevées sur le tiroir réduisent le solde théorique de la session ouverte."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/exchange-rates" className={ghostLinkClassName}>
              Taux de change
            </Link>
            <Link to="/admin/payments" className={ghostLinkClassName}>
              Encaissements
            </Link>
            {canManage ? (
              <button type="button" onClick={() => setShowCreate(true)} className={linkButtonClassName}>
                Nouvelle dépense
              </button>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Dépenses aujourd’hui" value={String(summary?.todayCount ?? "—")} hint="Pièces enregistrées" />
        <Kpi
          label="Montant du jour (USD eq.)"
          value={summary ? formatUsd(summary.todayAmountUsd) : "—"}
          hint="Taux décaissement"
          emphasize
        />
        <Kpi
          label="Prélevées tiroir (jour)"
          value={summary ? formatUsd(summary.drawerTodayUsd) : "—"}
          hint="Liées à une session ouverte"
        />
        <Kpi
          label="Cumul mois (USD eq.)"
          value={summary ? formatUsd(summary.monthAmountUsd) : "—"}
          hint={
            summary?.decaissementRate
              ? `Taux décaissement ${Math.round(summary.decaissementRate)} CDF/USD`
              : "Taux décaissement"
          }
        />
      </section>

      {summary && summary.pendingCashierToday > 0 ? (
        <Alert tone="info">
          {summary.pendingCashierToday} dépense(s) tiroir en attente de confirmation caissière aujourd’hui — le solde
          théorique n’est impacté qu’après confirmation sur la caisse.
        </Alert>
      ) : null}

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
                placeholder="Référence, description, site…"
                className={filterInputClassName}
              />
            </label>
            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Période</span>
              <select
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as PeriodPreset);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="today">Aujourd’hui</option>
                <option value="7d">7 derniers jours</option>
                <option value="30d">30 derniers jours</option>
                <option value="all">Tout</option>
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Boutique</span>
              <select
                value={storeId}
                onChange={(event) => {
                  setStoreId(event.target.value);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes (périmètre)</option>
                {(storesQuery.data?.items ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Site</span>
              <select
                value={scopeType}
                onChange={(event) => {
                  setScopeType(event.target.value as ExpenseScopeType | "");
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Tous</option>
                <option value="STORE">Boutiques</option>
                <option value="WAREHOUSE">Entrepôt</option>
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
                className={filterInputClassName}
              >
                <option value="">—</option>
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Catégorie</span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as ExpenseCategoryCode | "");
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes</option>
                {EXPENSE_CATEGORY_OPTIONS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["", "Toutes"],
                ["drawer", "Tiroir caisse"],
                ["off", "Hors tiroir"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setDrawerFilter(value);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  drawerFilter === value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-500">
                <th className="px-4 py-3 font-medium">Référence</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-right font-medium">USD eq.</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Tiroir</th>
                <th className="px-4 py-3 font-medium">Saisi par</th>
                <th className="px-4 py-3 font-medium">Justificatif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Chargement du journal…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Aucune dépense pour ces filtres.
                  </td>
                </tr>
              ) : (
                items.map((row) => <ExpenseRow key={row.id} row={row} />)
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
              itemLabel="dépenses"
            />
          </div>
        ) : null}
      </section>

      {canManage ? <ExpenseCreateModal open={showCreate} onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}

function ExpenseRow({ row }: { row: ExpenseListItem }) {
  return (
    <tr className="hover:bg-slate-50/70">
      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{row.reference}</td>
      <td className="px-4 py-3 text-slate-600">
        {new Date(row.spentAt).toLocaleString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="max-w-[12rem] truncate px-4 py-3 text-slate-700" title={expenseSiteLabel(row)}>
        {expenseSiteLabel(row)}
      </td>
      <td className="px-4 py-3 text-slate-700">{expenseCategoryLabel(row.category)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
        {row.currency === "CDF" ? formatCdf(row.amount) : formatUsd(row.amount)}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">{formatUsd(row.amountUsdEquivalent)}</td>
      <td className="px-4 py-3">
        <StatusBadge label={expenseStatusLabel(row.status)} tone={expenseStatusTone(row.status)} compact />
      </td>
      <td className="px-4 py-3">
        {row.fromCashDrawer ? (
          <span className="text-slate-700">
            {row.cashRegister ? `${row.cashRegister.code}` : "Tiroir"}
            {row.status === "PENDING_CASHIER_CONFIRMATION" ? (
              <span className="text-amber-700"> · attente</span>
            ) : null}
          </span>
        ) : (
          <StatusBadge label="Hors caisse" tone="neutral" compact />
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">{row.createdByName}</td>
      <td className="px-4 py-3">
        {row.receiptUrl ? (
          <a
            href={row.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline underline-offset-2"
          >
            Voir
          </a>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

function Kpi({
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-xl tabular-nums ${emphasize ? "font-bold text-slate-950" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function computeSpentRange(period: PeriodPreset): { from?: string; to?: string } {
  if (period === "all") {
    return {};
  }
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now);
  if (period === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from: from.toISOString(), to };
}