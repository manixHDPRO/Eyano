import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../StatusBadge";
import { fetchNotifications, markNotificationRead } from "../../lib/api/notifications";
import { fetchStockLevels, fetchStockSummary } from "../../lib/api/stock";
import type { StockLevelItem } from "../../lib/api/types";
import { canReadAppNotifications } from "../../lib/auth/notification-access";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../../modules/auth/AuthProvider";
import { LIVE_SYNC_INTERVAL_MS } from "../../lib/query/live-sync";
import { locationLabel, stockAlertLabel, stockAlertTone } from "../../modules/stock/stock-display";

export function AdminStockAlertsBell() {
  const { user } = useAuth();
  const canStock = hasPermission(user, "stock.read");
  const canNotifs = canReadAppNotifications(user);
  const enabled = canStock || canNotifs;

  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["stock-summary"],
    queryFn: fetchStockSummary,
    enabled: canStock && enabled,
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
  });

  const stockoutQuery = useQuery({
    queryKey: ["stock-levels", "bell", "STOCKOUT"],
    queryFn: () => fetchStockLevels({ alertStatus: "STOCKOUT", page: 1, pageSize: 12 }),
    enabled: canStock && enabled,
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
  });

  const lowQuery = useQuery({
    queryKey: ["stock-levels", "bell", "LOW"],
    queryFn: () => fetchStockLevels({ alertStatus: "LOW", page: 1, pageSize: 12 }),
    enabled: canStock && enabled,
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
  });

  const notifQuery = useQuery({
    queryKey: ["notifications", "stock-bell"],
    queryFn: () => fetchNotifications({ unreadOnly: true, pageSize: 30 }),
    enabled: canNotifs && enabled,
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
  });

  const unreadNotifs = notifQuery.data?.items ?? [];

  const alertItems = useMemo(() => {
    const stockout = stockoutQuery.data?.items ?? [];
    const low = lowQuery.data?.items ?? [];
    return [...stockout, ...low].slice(0, 14);
  }, [lowQuery.data?.items, stockoutQuery.data?.items]);

  const badgeCount = useMemo(() => {
    if (canStock && summaryQuery.data) {
      return summaryQuery.data.low + summaryQuery.data.stockout;
    }
    if (notifQuery.data?.unreadCount) {
      return notifQuery.data.unreadCount;
    }
    return alertItems.length;
  }, [alertItems.length, canNotifs, canStock, notifQuery.data?.unreadCount, summaryQuery.data]);

  const hasStockout = (summaryQuery.data?.stockout ?? 0) > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!enabled) {
    return null;
  }

  async function onMarkNotifRead(id: string) {
    await markNotificationRead(id);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-label="Alertes stock — ruptures et seuils"
        title="Alertes stock"
      >
        <BellIcon />
        {badgeCount > 0 ? (
          <span
            className={`absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              hasStockout ? "bg-red-600" : "bg-amber-600"
            }`}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Alertes de stock"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Alertes stock</p>
            <p className="mt-0.5 text-xs text-slate-500">Ruptures et produits sous le seuil configuré</p>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain">
            {unreadNotifs.length > 0 ? (
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Notifications non lues
                </p>
                <ul className="space-y-1">
                  {unreadNotifs.slice(0, 6).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => void onMarkNotifRead(row.id)}
                        className="w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-slate-50"
                      >
                        <p className="font-medium text-slate-900">{row.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-slate-600">{row.body}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canStock ? (
              alertItems.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-slate-500">
                  Aucune rupture ni alerte de seuil sur votre périmètre.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {alertItems.map((level) => (
                    <StockAlertRow key={level.id} level={level} />
                  ))}
                </ul>
              )
            ) : (
              <p className="px-4 py-6 text-xs text-slate-500">Consultez les notifications ci-dessus pour le détail stock.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <Link
              to="/admin/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
            >
              Centre de notifications
            </Link>
            {canStock ? (
              <Link
                to="/admin/stock"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Soldes stock
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StockAlertRow({ level }: { level: StockLevelItem }) {
  return (
    <li className="flex items-start gap-2 px-4 py-2.5">
      <AlertDot status={level.alertStatus} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-900">{level.product.name}</p>
        <p className="font-mono text-[11px] text-slate-400">{level.product.reference}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{locationLabel(level)}</p>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge label={stockAlertLabel(level.alertStatus)} tone={stockAlertTone(level.alertStatus)} compact />
        <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-slate-900">{level.quantityOnHand} u.</p>
        {level.alertStatus === "LOW" ? (
          <p className="text-[10px] text-slate-400">seuil {level.effectiveThreshold}</p>
        ) : null}
      </div>
    </li>
  );
}

function AlertDot({ status }: { status: StockLevelItem["alertStatus"] }) {
  return (
    <span
      className={`mt-1 size-2 shrink-0 rounded-full ${status === "STOCKOUT" ? "bg-red-500" : "bg-amber-500"}`}
      aria-hidden
    />
  );
}

function BellIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 10a6 6 0 1112 0c0 5 2 5 2 5H4s2 0 2-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}