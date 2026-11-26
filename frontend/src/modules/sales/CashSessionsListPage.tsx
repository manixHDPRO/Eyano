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
import { fetchCashSessions } from "../../lib/api/cash-sessions";
import { fetchStores } from "../../lib/api/stores";
import type { CashSessionListItem } from "../../lib/api/types";
import { formatCdf, formatUsd } from "../catalog/money";

export function CashSessionsListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [storeId, setStoreId] = useState("");

  const storesQuery = useQuery({
    queryKey: ["stores-cash-sessions-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100, status: "ACTIVE" }),
  });

  const listQuery = useQuery({
    queryKey: ["cash-sessions-list", page, status, storeId],
    queryFn: () =>
      fetchCashSessions({
        page,
        pageSize: 15,
        status: status === "OPEN" || status === "CLOSED" ? status : undefined,
        storeId: storeId || undefined,
      }),
  });

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];
  const storeOptions = storesQuery.data?.items ?? [];

  const pageStats = useMemo(() => {
    const openOnPage = items.filter((row) => row.status === "OPEN").length;
    const salesOnPage = items.reduce((sum, row) => sum + row.salesCount, 0);
    return { openOnPage, salesOnPage };
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventes & caisse"
        title="Sessions de caisse"
        description="Chaque session correspond à une journée (ou plage) sur une caisse : fond, ventes encaissées, dépenses tiroir et solde — comme à la clôture POS."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/sales" className={ghostLinkClassName}>
              Historique ventes
            </Link>
            <Link to="/pos" className={linkButtonClassName}>
              Ouvrir / clôturer (POS)
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Sessions (total)"
          value={listQuery.data ? String(listQuery.data.total) : "—"}
          hint="Selon filtres et périmètre"
        />
        <Kpi
          label="Ouvertes (page)"
          value={listQuery.isLoading ? "…" : String(pageStats.openOnPage)}
          hint="Sessions non clôturées affichées"
          emphasize={pageStats.openOnPage > 0}
        />
        <Kpi
          label="Ventes (page)"
          value={listQuery.isLoading ? "…" : String(pageStats.salesOnPage)}
          hint="Tickets rattachés aux sessions listées"
        />
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Journal des sessions</h2>
          <p className="mt-0.5 text-xs text-slate-500">Triées par date d’ouverture, les plus récentes en premier.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <label className="sm:col-span-2 lg:col-span-2">
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
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} — {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={filterLabelClassName}>Statut</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes</option>
                <option value="OPEN">Ouvertes</option>
                <option value="CLOSED">Clôturées</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="border-b border-slate-200 bg-white text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">Boutique · Caisse</th>
                <th className="px-4 py-3 font-medium">Responsable</th>
                <th className="px-4 py-3 text-right font-medium">Ventes</th>
                <th className="px-4 py-3 text-right font-medium">Fond initial</th>
                <th className="px-4 py-3 font-medium">Ouverture</th>
                <th className="px-4 py-3 font-medium">Clôture</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Chargement des sessions…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">Aucune session</p>
                    <p className="mt-1 text-xs text-slate-500">Affinez les filtres ou ouvrez une caisse depuis le POS.</p>
                  </td>
                </tr>
              ) : (
                items.map((session) => <CashSessionTableRow key={session.id} session={session} />)
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
              itemLabel="sessions"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CashSessionTableRow({ session }: { session: CashSessionListItem }) {
  const opened = formatSessionDateTime(session.openedAt);
  const closed = session.closedAt ? formatSessionDateTime(session.closedAt) : null;

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50/80">
      <td className="px-4 py-3">
        <Link
          to={`/admin/cash-sessions/${session.id}`}
          className="font-mono text-xs font-semibold text-slate-900 hover:underline"
          title={session.id}
        >
          #{session.id.slice(0, 8).toUpperCase()}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-800">
        <span className="font-medium">{session.store.code}</span>
        <span className="text-slate-500"> · {session.store.name}</span>
        <p className="mt-0.5 text-xs text-slate-500">
          {session.cashRegister.code} — {session.cashRegister.name}
        </p>
      </td>
      <td className="px-4 py-3 text-slate-700">{session.openedByName}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">{session.salesCount}</td>
      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
        <span className="block">{formatUsd(session.openingFloatUsd)}</span>
        <span className="block text-slate-500">{formatCdf(session.openingFloatCdf)}</span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">{opened.day}</p>
        <p className="font-mono text-xs tabular-nums text-slate-500">{opened.time}</p>
      </td>
      <td className="px-4 py-3">
        {closed ? (
          <>
            <p className="font-medium text-slate-800">{closed.day}</p>
            <p className="font-mono text-xs tabular-nums text-slate-500">{closed.time}</p>
          </>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          label={session.status === "OPEN" ? "Ouverte" : "Clôturée"}
          tone={session.status === "OPEN" ? "success" : "neutral"}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/admin/cash-sessions/${session.id}`}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          Situation
        </Link>
      </td>
    </tr>
  );
}

function formatSessionDateTime(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function Kpi(props: { label: string; value: string; hint: string; emphasize?: boolean }) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        props.emphasize ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{props.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{props.value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{props.hint}</p>
    </article>
  );
}