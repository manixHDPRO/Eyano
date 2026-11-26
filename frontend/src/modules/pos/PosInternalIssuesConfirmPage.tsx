import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { confirmStoreInternalIssue, fetchPendingStoreInternalIssues } from "../../lib/api/internal-issues";
import { fetchPosWorkspace } from "../../lib/api/pos";
import { canReadAppNotifications } from "../../lib/auth/notification-access";
import { useAuth } from "../auth/AuthProvider";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { internalIssueReasonLabel } from "../internal-issues/internal-issue-status";

export function PosInternalIssuesConfirmPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const canReadNotifications = canReadAppNotifications(user);

  const workspaceQuery = useQuery({
    queryKey: ["pos-workspace"],
    queryFn: fetchPosWorkspace,
    enabled: canReadNotifications,
  });

  const storeId = workspaceQuery.data?.primaryStoreId ?? user?.stores[0]?.id ?? null;

  const listQuery = useQuery({
    queryKey: ["internal-issues-pending-store", storeId],
    queryFn: () => fetchPendingStoreInternalIssues(storeId!),
    enabled: Boolean(storeId),
    refetchInterval: 15_000,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmStoreInternalIssue(id),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["internal-issues-pending-store"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["internal-issues"] });
      pushToast({
        tone: "success",
        message: `Sortie ${detail.reference} confirmée par la boutique.`,
      });
    },
    onError: (error) =>
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Confirmation impossible.") }),
  });

  const items = listQuery.data?.items ?? [];
  const { page, setPage, slice, totalPages, totalItems } = useClientPagination(items, 15);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sorties internes à confirmer</h1>
          <p className="mt-1 text-sm text-slate-500">
            Accusez réception des demandes pour votre boutique avant validation centrale.
          </p>
        </div>
        <Link
          to="/pos"
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Retour caisse
        </Link>
      </div>

      {listQuery.isError ? (
        <Alert tone="error">{formatApiErrorMessage(listQuery.error, "Chargement impossible.")}</Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="px-4 py-3 font-medium">N° Demande</th>
              <th className="px-4 py-3 font-medium">Produit</th>
              <th className="px-4 py-3 text-right font-medium">Qté</th>
              <th className="px-4 py-3 font-medium">Motif</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aucune sortie en attente de confirmation.
                </td>
              </tr>
            ) : (
              slice.map((issue) => (
                <tr key={issue.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{issue.reference}</td>
                  <td className="px-4 py-3 text-slate-900">{issue.productName}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{issue.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {internalIssueReasonLabel(issue.reasonCode)}
                    {issue.reasonText ? ` · ${issue.reasonText}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate(issue.id)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {items.length > 0 ? (
          <div className="border-t border-slate-200 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} itemLabel="demandes" />
          </div>
        ) : null}
      </div>
    </main>
  );
}