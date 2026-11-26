import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Pagination } from "../../components/ui/Pagination";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  approveInternalIssue,
  fetchInternalIssues,
  rejectInternalIssue,
} from "../../lib/api/internal-issues";
import type { InternalIssueListItem, InternalIssueStatus } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { InternalIssueCreateModal } from "./InternalIssueCreateModal";
import {
  internalIssueReasonLabel,
  internalIssueStatusLabel,
  locationLabel,
  personName,
} from "./internal-issue-status";

export function InternalIssuesListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const canRequest = hasPermission(user, "internal_issues.request");
  const canValidate = hasPermission(user, "internal_issues.validate");

  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ["internal-issues", "hd-table", page],
    queryFn: () => fetchInternalIssues({ page, pageSize: 20 }),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "reject" }) => {
      if (decision === "approve") {
        return approveInternalIssue(id);
      }
      return rejectInternalIssue(id, "Refus centrale");
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["internal-issues"] });
      await queryClient.invalidateQueries({ queryKey: ["internal-issues-summary"] });
      pushToast({
        tone: "success",
        message:
          variables.decision === "approve"
            ? "Sortie interne validée et stock déduit."
            : "Demande de sortie interne refusée.",
      });
    },
    onError: (error) =>
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Action impossible.") }),
  });

  const items = listQuery.data?.items ?? [];
  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sorties de stock pour usage interne
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Consommation interne, entretien ou casse soumis à validation centrale.
          </p>
        </div>
        {canRequest ? (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Demande de sortie interne
          </button>
        ) : null}
      </div>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-4 py-3 font-medium">N° Demande</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 text-right font-medium">Qté</th>
                <th className="px-4 py-3 font-medium">Motif</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Validation centrale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Chargement…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Aucune demande de sortie interne enregistrée.
                  </td>
                </tr>
              ) : (
                items.map((issue) => (
                  <InternalIssueRow
                    key={issue.id}
                    issue={issue}
                    canValidate={canValidate}
                    busy={reviewMutation.isPending}
                    onApprove={() => reviewMutation.mutate({ id: issue.id, decision: "approve" })}
                    onReject={() => reviewMutation.mutate({ id: issue.id, decision: "reject" })}
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
              itemLabel="demandes"
            />
          </div>
        ) : null}
      </div>

      <InternalIssueCreateModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

function InternalIssueRow({
  issue,
  canValidate,
  busy,
  onApprove,
  onReject,
}: {
  issue: InternalIssueListItem;
  canValidate: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const motive = issue.reasonText
    ? `${internalIssueReasonLabel(issue.reasonCode)} · ${issue.reasonText}`
    : internalIssueReasonLabel(issue.reasonCode);

  const reviewedName = issue.reviewedBy ? personName(issue.reviewedBy) : null;

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="px-4 py-3 font-mono font-semibold text-slate-900">
        <Link to={`/admin/internal-issues/${issue.id}`} className="hover:underline">
          {issue.reference}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-700">{locationLabel(issue)}</td>
      <td className="px-4 py-3 font-medium text-slate-900">{issue.productName}</td>
      <td className="px-4 py-3 text-right font-mono text-sm font-bold tabular-nums">{issue.quantity}</td>
      <td className="px-4 py-3 text-slate-600">{motive}</td>
      <td className="px-4 py-3">
        <IssueStatusCell status={issue.status} />
      </td>
      <td className="px-4 py-3 text-right">
        {issue.status === "PENDING" && canValidate ? (
          issue.store && !issue.storeConfirmedAt ? (
            <span className="font-medium text-amber-700">Attente confirmation boutique</span>
          ) : (
            <div className="inline-flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Valider
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onReject}
                className="rounded border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Refuser
              </button>
            </div>
          )
        ) : (
          <span className="text-slate-400">{reviewedName ?? "—"}</span>
        )}
      </td>
    </tr>
  );
}

function IssueStatusCell({ status }: { status: InternalIssueStatus }) {
  const label = internalIssueStatusLabel(status);
  if (status === "PENDING") {
    return <span className="font-medium text-amber-700">{label}</span>;
  }
  if (status === "APPROVED") {
    return <span className="font-semibold text-emerald-700">{label}</span>;
  }
  if (status === "REJECTED") {
    return <span className="font-semibold text-red-700">{label}</span>;
  }
  return <span className="text-slate-600">{label}</span>;
}