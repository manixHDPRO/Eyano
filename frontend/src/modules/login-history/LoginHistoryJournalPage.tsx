import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { Pagination } from "../../components/ui/Pagination";
import { fetchLoginHistories, fetchLoginHistoriesSummary } from "../../lib/api/login-histories";
import { formatApiErrorMessage } from "../../lib/api/errors";
import type { LoginHistoryItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import {
  formatLoginWhen,
  loginActorLabel,
  loginActorSecondary,
  loginOutcomeLabel,
  loginOutcomeTone,
  parseClientHint,
  summarizeUserAgent,
} from "./login-history-display";

type PeriodPreset = "today" | "7d" | "30d" | "all";
type OutcomeFilter = "all" | "success" | "failed";
type UserScopeFilter = "all" | "known" | "unknown";

export function LoginHistoryJournalPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialUserId = searchParams.get("userId") ?? "";
  const canSettings = hasPermission(user, "settings.update") || hasPermission(user, "settings.update_critical");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("7d");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [userScope, setUserScope] = useState<UserScopeFilter>("all");
  const [userId] = useState(initialUserId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const range = useMemo(() => computeCreatedRange(period), [period]);
  const successFilter = outcome === "all" ? undefined : outcome === "success";

  const summaryQuery = useQuery({
    queryKey: ["login-histories-summary"],
    queryFn: fetchLoginHistoriesSummary,
  });

  const listQuery = useQuery({
    queryKey: ["login-histories", page, search, range.from, range.to, outcome, userScope, userId],
    queryFn: () =>
      fetchLoginHistories({
        page,
        pageSize: 20,
        userId: userId || undefined,
        success: successFilter,
        search: search.trim() || undefined,
        from: range.from,
        to: range.to,
        userScope: userScope === "all" ? undefined : userScope,
      }),
  });

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Historique des connexions</h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            Chaque tentative d’authentification est conservée : succès et échecs, adresse IP et signature navigateur.
            Complète le journal d’audit métier sans remplacer celui-ci.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/audit" className={ghostLinkClassName}>
            Journal d’audit
          </Link>
          {canSettings ? (
            <Link to="/admin/settings" className={ghostLinkClassName}>
              Paramètres sécurité
            </Link>
          ) : null}
        </div>
      </div>

      {userId ? (
        <Alert tone="info">
          Filtre actif sur un compte utilisateur.{" "}
          <Link to="/admin/login-history" className="font-medium text-slate-800 underline-offset-2 hover:underline">
            Voir toutes les connexions
          </Link>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tentatives aujourd’hui" value={String(summary?.todayTotal ?? "—")} hint="Succès + échecs" />
        <Kpi label="Connexions réussies" value={String(summary?.todaySuccess ?? "—")} hint="Depuis minuit" />
        <Kpi
          label="Échecs aujourd’hui"
          value={String(summary?.todayFailed ?? "—")}
          hint={`${summary?.unknownAttemptsToday ?? "—"} identité(s) inconnue(s)`}
          emphasize={(summary?.todayFailed ?? 0) > 0}
        />
        <Kpi
          label="Échecs 24 h"
          value={String(summary?.failedLast24h ?? "—")}
          hint={`${summary?.last7DaysFailed ?? "—"} sur 7 jours`}
        />
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
            <label className="lg:col-span-4">
              <span className={filterLabelClassName}>Recherche</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="E-mail, nom, IP, navigateur…"
                className={filterInputClassName}
              />
            </label>
            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Résultat</span>
              <select
                value={outcome}
                onChange={(event) => {
                  setOutcome(event.target.value as OutcomeFilter);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="all">Toutes</option>
                <option value="success">Réussies</option>
                <option value="failed">Échouées</option>
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Compte</span>
              <select
                value={userScope}
                onChange={(event) => {
                  setUserScope(event.target.value as UserScopeFilter);
                  setPage(1);
                }}
                disabled={Boolean(userId)}
                className={filterInputClassName}
              >
                <option value="all">Tous</option>
                <option value="known">Compte reconnu</option>
                <option value="unknown">Identité inconnue</option>
              </select>
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
                <option value="7d">7 jours</option>
                <option value="30d">30 jours</option>
                <option value="all">Tout</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  outcome === "failed"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
                onClick={() => {
                  setOutcome((current) => (current === "failed" ? "all" : "failed"));
                  setPage(1);
                }}
              >
                Échecs uniquement
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Résultat</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Adresse IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Chargement de l’historique…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Aucune tentative pour ces filtres. Les connexions et les échecs sont enregistrés dès la page de login.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <LoginRow
                    key={row.id}
                    row={row}
                    expanded={expandedId === row.id}
                    onToggle={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                  />
                ))
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
              itemLabel="tentatives"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LoginRow({
  row,
  expanded,
  onToggle,
}: {
  row: LoginHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const client = parseClientHint(row.userAgent);
  const ipLabel = row.ip ?? "—";

  return (
    <>
      <tr className={`cursor-pointer hover:bg-slate-50/80 ${expanded ? "bg-slate-50/70" : ""}`} onClick={onToggle}>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">{formatLoginWhen(row.createdAt)}</td>
        <td className="px-4 py-3">
          {row.user ? (
            <Link
              to={`/admin/users/${row.user.id}`}
              onClick={(event) => event.stopPropagation()}
              className="group block"
            >
              <p className="font-medium text-slate-800 group-hover:text-slate-950">{loginActorLabel(row)}</p>
              <p className="font-mono text-[11px] text-slate-400">{loginActorSecondary(row)}</p>
            </Link>
          ) : (
            <>
              <p className="font-medium text-slate-800">{loginActorLabel(row)}</p>
              <p className="text-[11px] text-slate-500">{loginActorSecondary(row)}</p>
            </>
          )}
          {row.user ? (
            <p className="mt-1 text-[11px] text-slate-400">
              {row.user.roleName}{" "}
              <span className="font-mono text-slate-400">({row.user.roleCode})</span>
            </p>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <StatusBadge label={loginOutcomeLabel(row.success)} tone={loginOutcomeTone(row.success)} compact />
        </td>
        <td className="px-4 py-3">
          <p className="text-slate-800">
            {client.browser} · {client.os}
          </p>
          <p className="mt-0.5 max-w-xs truncate text-[11px] text-slate-500" title={row.userAgent ?? undefined}>
            {summarizeUserAgent(row.userAgent)}
          </p>
        </td>
        <td className="px-4 py-3 font-mono text-slate-600">{ipLabel}</td>
      </tr>
      {expanded ? (
        <tr className="bg-slate-50/90">
          <td colSpan={5} className="px-4 py-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Agent utilisateur complet</p>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-700">
                {row.userAgent?.trim() || "Non enregistré"}
              </p>
            </div>
            <p className="mt-3 font-mono text-[11px] text-slate-400">Identifiant journal {row.id}</p>
          </td>
        </tr>
      ) : null}
    </>
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
      <p className={`mt-1 font-mono text-xl tabular-nums ${emphasize ? "font-bold text-rose-700" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function computeCreatedRange(period: PeriodPreset): { from?: string; to?: string } {
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