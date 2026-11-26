import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchLoginHistories } from "../../lib/api/login-histories";
import {
  formatLoginWhen,
  loginOutcomeLabel,
  loginOutcomeTone,
  parseClientHint,
} from "./login-history-display";

type LoginHistoryRecentPanelProps = {
  userId: string;
};

export function LoginHistoryRecentPanel({ userId }: LoginHistoryRecentPanelProps) {
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ["login-histories-user", userId, page],
    queryFn: () => fetchLoginHistories({ page, pageSize: 8, userId }),
  });

  const errorMessage = listQuery.isError
    ? formatApiErrorMessage(listQuery.error, "Historique de connexion indisponible.")
    : null;
  const items = listQuery.data?.items ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Connexions récentes</p>
          <p className="mt-1 text-sm text-slate-500">
            Tentatives enregistrées pour ce compte — succès et échecs avec IP et client.
          </p>
        </div>
        <Link to={`/admin/login-history?userId=${encodeURIComponent(userId)}`} className={ghostLinkClassName}>
          Voir tout
        </Link>
      </div>
      {errorMessage ? (
        <div className="mt-4">
          <Alert tone="error">{errorMessage}</Alert>
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-slate-100">
        {items.map((row) => {
          const client = parseClientHint(row.userAgent);
          return (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={loginOutcomeLabel(row.success)} tone={loginOutcomeTone(row.success)} compact />
                  <span className="text-xs text-slate-500">{formatLoginWhen(row.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {client.browser} · {client.os}
                  {row.ip ? <span className="font-mono text-slate-500"> · {row.ip}</span> : null}
                </p>
              </div>
            </li>
          );
        })}
        {items.length === 0 && !listQuery.isLoading ? (
          <li className="py-8 text-center text-sm text-slate-500">Aucune tentative enregistrée pour ce compte.</li>
        ) : null}
      </ul>
      {listQuery.data && listQuery.data.totalPages > 1 ? (
        <div className="mt-2 border-t border-slate-100 pt-3">
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
  );
}