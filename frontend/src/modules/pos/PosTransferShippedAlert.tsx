import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchNotifications } from "../../lib/api/notifications";

type PosTransferShippedAlertProps = {
  storeId: string | null;
  fallbackStoreId?: string | null;
  /** Peut lire l’API notifications (ex. stock.read côté caissière). */
  pollEnabled: boolean;
};

export function PosTransferShippedAlert({
  storeId,
  fallbackStoreId,
  pollEnabled,
}: PosTransferShippedAlertProps) {
  const alertStoreId = storeId ?? fallbackStoreId ?? null;

  const alertsQuery = useQuery({
    queryKey: ["notifications", "TRANSFER_SHIPPED", alertStoreId],
    queryFn: () =>
      fetchNotifications({
        storeId: alertStoreId!,
        type: "TRANSFER_SHIPPED",
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
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs text-emerald-950 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-emerald-900">
            {items.length === 1
              ? "Un transfert expédié attend votre confirmation de réception"
              : `${items.length} transferts expédiés attendent la réception boutique`}
          </p>
          <ul className="mt-2 space-y-1 text-emerald-900/90">
            {items.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>
                <span className="text-emerald-800/80"> — {item.body}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link
          to="/pos/receive-transfers?status=SHIPPED"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
        >
          Vérifier et réceptionner
        </Link>
      </div>
    </section>
  );
}