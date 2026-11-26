import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchNotifications } from "../../lib/api/notifications";

type PosExpensePendingAlertProps = {
  storeId: string | null;
  fallbackStoreId?: string | null;
  pollEnabled: boolean;
};

export function PosExpensePendingAlert({
  storeId,
  fallbackStoreId,
  pollEnabled,
}: PosExpensePendingAlertProps) {
  const alertStoreId = storeId ?? fallbackStoreId ?? null;

  const alertsQuery = useQuery({
    queryKey: ["notifications", "EXPENSE_DRAWER_PENDING", alertStoreId],
    queryFn: () =>
      fetchNotifications({
        storeId: alertStoreId!,
        type: "EXPENSE_DRAWER_PENDING",
        unreadOnly: true,
        pageSize: 5,
      }),
    enabled: pollEnabled && Boolean(alertStoreId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const items = alertsQuery.data?.items ?? [];
  if (!pollEnabled || items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-amber-900">
            {items.length === 1
              ? "Une dépense tiroir attend votre confirmation"
              : `${items.length} dépenses tiroir attendent votre confirmation`}
          </p>
          <ul className="mt-2 space-y-1 text-amber-900/90">
            {items.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>
                <span className="text-amber-800/80"> — {item.body}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link
          to="/pos/confirm-expenses"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-800 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-900"
        >
          Confirmer les sorties
        </Link>
      </div>
    </section>
  );
}