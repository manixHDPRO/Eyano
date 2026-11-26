import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { Pagination } from "../../components/ui/Pagination";
import { fetchAuditLogs, fetchAuditLogsCatalog, fetchAuditLogsSummary } from "../../lib/api/audit-logs";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchStores } from "../../lib/api/stores";
import type { AuditDomain, AuditLogItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import {
  AUDIT_DOMAIN_OPTIONS,
  auditActionLabel,
  auditActionTone,
  auditActorName,
  auditEntityHref,
  auditEntityLabel,
  formatAuditJson,
  formatAuditWhen,
  shortEntityId,
} from "./audit-display";

type PeriodPreset = "today" | "7d" | "30d" | "all";

export function AuditJournalPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState("");
  const [domain, setDomain] = useState<AuditDomain | "">("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("7d");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canStores = hasPermission(user, "stores.manage");
  const canSettings = hasPermission(user, "settings.update") || hasPermission(user, "settings.update_critical");
  const canUsers = hasPermission(user, "users.manage");
  const range = useMemo(() => computeCreatedRange(period), [period]);

  const storesQuery = useQuery({
    queryKey: ["stores-audit-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
    enabled: canStores,
  });

  const catalogQuery = useQuery({
    queryKey: ["audit-logs-catalog"],
    queryFn: fetchAuditLogsCatalog,
  });

  const summaryQuery = useQuery({
    queryKey: ["audit-logs-summary", storeId],
    queryFn: () => fetchAuditLogsSummary(storeId || undefined),
  });

  const listQuery = useQuery({
    queryKey: ["audit-logs", page, storeId, domain, action, search, range.from, range.to, sensitiveOnly],
    queryFn: () =>
      fetchAuditLogs({
        page,
        pageSize: 20,
        storeId: storeId || undefined,
        domain: domain || undefined,
        action: action || undefined,
        search: search.trim() || undefined,
        from: range.from,
        to: range.to,
        sensitiveOnly: sensitiveOnly || undefined,
      }),
  });

  const storeOptions = useMemo(() => {
    if (canStores) {
      return storesQuery.data?.items ?? [];
    }
    return user?.stores ?? [];
  }, [canStores, storesQuery.data?.items, user?.stores]);

  const actionOptions = useMemo(() => {
    const rows = catalogQuery.data?.actions ?? [];
    const filtered = domain ? rows.filter((row) => row.domain === domain) : rows;
    return [...filtered].sort((a, b) => auditActionLabel(a.value).localeCompare(auditActionLabel(b.value), "fr"));
  }, [catalogQuery.data?.actions, domain]);

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Journal d’audit</h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            Trace append-only des intentions : auteur, action, ancienne et nouvelle valeur. Le grand livre de stock
            reste la trace quantitative.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUsers ? (
            <Link to="/admin/users" className={ghostLinkClassName}>
              Utilisateurs & rôles
            </Link>
          ) : null}
          {canSettings ? (
            <Link to="/admin/settings" className={ghostLinkClassName}>
              Paramètres
            </Link>
          ) : null}
          <Link to="/admin/login-history" className={ghostLinkClassName}>
            Historique des connexions
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Événements aujourd’hui" value={String(summary?.todayCount ?? "—")} hint="Depuis minuit" />
        <Kpi
          label="7 derniers jours"
          value={String(summary?.last7DaysCount ?? "—")}
          hint="Volume d’activité"
        />
        <Kpi
          label="Sensibles aujourd’hui"
          value={String(summary?.sensitiveTodayCount ?? "—")}
          hint="Prix, caisse, ventes, paramètres"
          emphasize
        />
        <Kpi
          label="Auteurs distincts"
          value={String(summary?.uniqueActorsToday ?? "—")}
          hint="Comptes actifs aujourd’hui"
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
                placeholder="Auteur, action, entité, IP, boutique…"
                className={filterInputClassName}
              />
            </label>
            <label className="lg:col-span-3">
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
            <label className="lg:col-span-2">
              <span className={filterLabelClassName}>Domaine</span>
              <select
                value={domain}
                onChange={(event) => {
                  const next = event.target.value as AuditDomain | "";
                  setDomain(next);
                  setAction("");
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                {AUDIT_DOMAIN_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="lg:col-span-3">
              <span className={filterLabelClassName}>Action</span>
              <select
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes</option>
                {actionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {auditActionLabel(option.value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(
              [
                ["today", "Aujourd’hui"],
                ["7d", "7 jours"],
                ["30d", "30 jours"],
                ["all", "Tout"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPeriod(value);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  period === value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSensitiveOnly((current) => !current);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                sensitiveOnly
                  ? "border border-amber-300 bg-amber-50 text-amber-900"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              Actions sensibles
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entité</th>
                <th className="px-4 py-3 font-medium">Boutique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Chargement du journal…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Aucune entrée pour ces filtres. Les actions sensibles (prix, paramètres, caisse, ventes) sont
                    journalisées automatiquement.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <AuditRow
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
              itemLabel="événements"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AuditRow({
  row,
  expanded,
  onToggle,
}: {
  row: AuditLogItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const href = auditEntityHref(row.entityType, row.entityId);
  const storeLabel = row.store ? `${row.store.code} — ${row.store.name}` : "—";

  return (
    <>
      <tr className={`cursor-pointer hover:bg-slate-50/80 ${expanded ? "bg-slate-50/70" : ""}`} onClick={onToggle}>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">{formatAuditWhen(row.createdAt)}</td>
        <td className="px-4 py-3">
          <p className="font-medium text-slate-800">{auditActorName(row)}</p>
          <p className="font-mono text-[11px] text-slate-400">{row.actor?.email ?? "système"}</p>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={auditActionLabel(row.action)} tone={auditActionTone(row.action, row.sensitive)} compact />
            {row.sensitive ? <StatusBadge label="Sensible" tone="warning" compact /> : null}
          </div>
          <p className="mt-1.5 max-w-sm text-slate-600">{row.summary}</p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="mt-1 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            {expanded ? "Masquer les valeurs" : "Voir les valeurs"}
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="text-slate-800">{auditEntityLabel(row.entityType)}</p>
          {href ? (
            <Link
              to={href}
              onClick={(event) => event.stopPropagation()}
              className="font-mono text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              title={row.entityId}
            >
              {shortEntityId(row.entityId)}
            </Link>
          ) : (
            <p className="font-mono text-[11px] text-slate-400" title={row.entityId}>
              {shortEntityId(row.entityId)}
            </p>
          )}
        </td>
        <td className="max-w-[12rem] truncate px-4 py-3 text-slate-600" title={storeLabel}>
          {storeLabel}
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-slate-50/90">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <JsonPanel title="Ancienne valeur" value={row.oldValue} />
              <JsonPanel title="Nouvelle valeur" value={row.newValue} />
            </div>
            <p className="mt-3 font-mono text-[11px] text-slate-400">
              {row.ip ? `IP ${row.ip}` : "IP inconnue"}
              {row.userAgent ? ` · ${row.userAgent}` : ""}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <pre className="max-h-56 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700">
        {formatAuditJson(value)}
      </pre>
    </div>
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
