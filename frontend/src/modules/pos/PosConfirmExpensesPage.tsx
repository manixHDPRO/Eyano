import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { confirmCashierExpense, fetchPendingCashierExpenses } from "../../lib/api/expenses";
import { fetchPosWorkspace } from "../../lib/api/pos";
import { canReadAppNotifications } from "../../lib/auth/notification-access";
import { useAuth } from "../auth/AuthProvider";
import { formatCdf, formatUsd } from "../catalog/money";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { expenseCategoryLabel } from "../finance/expense-labels";

export function PosConfirmExpensesPage() {
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
  const defaultRegister =
    workspaceQuery.data?.registers.find((row) => row.openSession) ??
    workspaceQuery.data?.registers.find((row) => row.isDefault) ??
    workspaceQuery.data?.registers[0];

  const listQuery = useQuery({
    queryKey: ["expenses-pending-cashier", storeId, defaultRegister?.id],
    queryFn: () =>
      fetchPendingCashierExpenses({
        storeId: storeId!,
        cashRegisterId: defaultRegister?.id,
      }),
    enabled: Boolean(storeId),
    refetchInterval: 15_000,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmCashierExpense(id),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["expenses-pending-cashier"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["cash-session"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      pushToast({
        tone: "success",
        message: `Sortie confirmée — dépense ${detail.reference} imputée au tiroir.`,
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
          <h1 className="text-xl font-bold text-slate-900">Dépenses tiroir à confirmer</h1>
          <p className="mt-1 text-sm text-slate-500">
            Validez les sorties d’espèces saisies par l’administration ou la comptabilité avant impact sur le solde
            théorique.
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
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">Caisse</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 text-right font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Saisie par</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Aucune dépense en attente de confirmation.
                </td>
              </tr>
            ) : (
              slice.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{expense.reference}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {expense.cashRegister ? `${expense.cashRegister.code} — ${expense.cashRegister.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{expenseCategoryLabel(expense.category)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {expense.currency === "CDF" ? formatCdf(expense.amount) : formatUsd(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{expense.createdByName}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate(expense.id)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Confirmer la sortie
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {items.length > 0 ? (
          <div className="border-t border-slate-200 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} itemLabel="dépenses" />
          </div>
        ) : null}
      </div>
    </main>
  );
}