import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/ui/Pagination";
import type { AdminDashboardPayload } from "../../lib/api/dashboard";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { formatCdf, formatUsd } from "../catalog/money";
import { expenseCategoryLabel } from "../finance/expense-labels";
import { expenseStatusLabel, expenseStatusTone } from "../finance/expense-status";
import { ReceiptIcon } from "./DashboardIcons";

type Props = {
  todayExpenses: AdminDashboardPayload["todayExpenses"];
  canManage: boolean;
};

export function DashboardTodayExpensesSection({ todayExpenses, canManage }: Props) {
  const { items } = todayExpenses;
  const { page, setPage, slice, totalPages, totalItems } = useClientPagination(items, 10);

  return (
    <section className="dash-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b dash-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <ReceiptIcon className="mt-0.5 shrink-0 dash-faint" />
          <div>
            <h2 className="text-base font-semibold">Dépenses du jour</h2>
            <p className="text-xs dash-muted">Charges enregistrées aujourd’hui</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/expenses" className="dash-link text-xs">
            Journal complet
          </Link>
          {canManage ? (
            <Link to="/admin/expenses" className="dash-btn px-3 py-1.5 text-xs font-medium">
              Nouvelle dépense
            </Link>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b dash-line dash-muted">
              <th className="px-4 py-2.5 font-medium">Référence</th>
              <th className="px-4 py-2.5 font-medium">Heure</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Catégorie</th>
              <th className="px-4 py-2.5 text-right font-medium">Montant</th>
              <th className="px-4 py-2.5 text-right font-medium">USD eq.</th>
              <th className="px-4 py-2.5 font-medium">Statut</th>
              <th className="px-4 py-2.5 font-medium">Saisi par</th>
            </tr>
          </thead>
          <tbody className="dash-divide">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center dash-muted">
                  Aucune dépense enregistrée aujourd’hui.
                </td>
              </tr>
            ) : (
              slice.map((row) => (
                <tr key={row.id} className="dash-row">
                  <td className="px-4 py-2.5 font-mono font-semibold">{row.reference}</td>
                  <td className="px-4 py-2.5 dash-muted">
                    {new Date(row.spentAt).toLocaleString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-2.5 dash-muted" title={row.locationName}>
                    {row.locationName}
                  </td>
                  <td className="px-4 py-2.5 dash-muted">{expenseCategoryLabel(row.category)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {row.currency === "CDF" ? formatCdf(row.amount) : formatUsd(row.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums dash-muted">
                    {formatUsd(row.amountUsdEquivalent)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={expenseStatusLabel(row.status)} tone={expenseStatusTone(row.status)} />
                  </td>
                  <td className="px-4 py-2.5 dash-muted">{row.createdByName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {items.length > 0 ? (
        <div className="border-t dash-line px-5 py-3">
          <Pagination page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} itemLabel="dépenses" />
        </div>
      ) : null}
    </section>
  );
}