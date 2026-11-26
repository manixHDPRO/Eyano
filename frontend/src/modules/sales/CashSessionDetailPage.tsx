import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName, linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchCashSession } from "../../lib/api/cash-sessions";
import { formatCdf, formatUsd } from "../catalog/money";
import { CashSessionLedgerSummary } from "./CashSessionLedgerSummary";

function personName(row: { firstName: string; lastName: string }): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionDurationLabel(openedAt: string, closedAt: string | null): string {
  const start = new Date(openedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const hours = Math.max(0, Math.round((end - start) / (1000 * 60 * 60)));
  if (hours < 1) {
    return "Moins d’une heure";
  }
  if (hours === 1) {
    return "1 heure";
  }
  return `${hours} heures`;
}

export function CashSessionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const detailQuery = useQuery({
    queryKey: ["cash-session", id],
    queryFn: () => fetchCashSession(id!),
    enabled: Boolean(id),
  });

  const loadError = detailQuery.isError ? formatApiErrorMessage(detailQuery.error, "Chargement impossible.") : null;

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link to="/admin/cash-sessions" className={ghostLinkClassName}>
          ← Sessions de caisse
        </Link>
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  const session = detailQuery.data;
  if (!session) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const isOpen = session.status === "OPEN";
  const registerTitle = `${session.cashRegister.code} — ${session.cashRegister.name}`;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/admin/cash-sessions" className={ghostLinkClassName}>
          ← Sessions de caisse
        </Link>
        <span className="text-slate-300" aria-hidden>
          /
        </span>
        <span className="font-mono text-xs text-slate-500">{session.id.slice(0, 8).toUpperCase()}</span>
      </nav>

      <PageHeader
        eyebrow={`${session.store.code} · ${session.store.name}`}
        title={registerTitle}
        description={`Ouverte le ${formatDateTime(session.openedAt)} par ${personName(session.openedBy)} · durée ${sessionDurationLabel(session.openedAt, session.closedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={isOpen ? "Ouverte" : "Clôturée"} tone={isOpen ? "success" : "neutral"} />
            {isOpen ? (
              <Link to="/pos" className={linkButtonClassName}>
                Aller au POS
              </Link>
            ) : null}
          </div>
        }
      />

      {isOpen ? (
        <Alert tone="info">
          Cette session est toujours active sur la caisse. Les encaissements et dépenses tiroir confirmées mettent à jour
          le relevé ci-dessous en temps réel.
        </Alert>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 bg-slate-50/90 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Identité</h2>
            </header>
            <dl className="divide-y divide-slate-100 px-4 py-1">
              <MetaRow label="Référence session">
                <span className="font-mono text-xs" title={session.id}>
                  {session.id}
                </span>
              </MetaRow>
              <MetaRow label="Boutique">
                {session.store.name}
                {session.store.city ? (
                  <span className="block text-xs font-normal text-slate-500">{session.store.city}</span>
                ) : null}
              </MetaRow>
              <MetaRow label="Caisse">{registerTitle}</MetaRow>
              <MetaRow label="Ventes enregistrées">
                <span className="text-lg font-bold tabular-nums text-slate-900">{session.salesCount}</span>
              </MetaRow>
            </dl>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 bg-slate-50/90 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cycle de vie</h2>
            </header>
            <dl className="divide-y divide-slate-100 px-4 py-1">
              <MetaRow label="Ouverture">{formatDateTime(session.openedAt)}</MetaRow>
              <MetaRow label="Ouverte par">{personName(session.openedBy)}</MetaRow>
              {session.closedAt ? <MetaRow label="Clôture">{formatDateTime(session.closedAt)}</MetaRow> : null}
              {session.closedBy ? <MetaRow label="Clôturée par">{personName(session.closedBy)}</MetaRow> : null}
            </dl>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Aperçu solde</p>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-slate-900">
              {formatUsd(session.theoreticalBalanceUsd)}
            </p>
            <p className="font-mono text-sm tabular-nums text-slate-600">{formatCdf(session.theoreticalBalanceCdf)}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Solde théorique après fond, ventes espèces et dépenses tiroir.</p>
          </article>
        </aside>

        <CashSessionLedgerSummary
          session={session}
          variant="admin"
          title="Situation financière"
          subtitle="Même structure que l’écran de clôture POS : vous voyez ce qui est entré en caisse (ventes), ce qui est sorti (dépenses confirmées) et le solde attendu."
        />
      </section>

      <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <Link
          to={`/admin/sales?${new URLSearchParams({ storeId: session.store.id }).toString()}`}
          className={ghostLinkClassName}
        >
          Ventes de la boutique
        </Link>
        <Link to="/admin/expenses" className={ghostLinkClassName}>
          Journal des dépenses
        </Link>
        <Link to="/admin/payments" className={ghostLinkClassName}>
          Encaissements
        </Link>
      </section>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}