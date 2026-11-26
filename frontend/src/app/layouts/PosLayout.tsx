import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "react-router-dom";
import { EyanoLogo } from "../../components/EyanoLogo";
import { SessionActions } from "../../components/SessionActions";
import { fetchCurrentExchangeRates } from "../../lib/api/exchange-rates";
import { fetchNotificationUnreadCount } from "../../lib/api/notifications";
import { fetchPosWorkspace } from "../../lib/api/pos";
import { DEFAULT_ENCAISSEMENT_CDF_PER_USD, formatCdfPerUsd } from "../../lib/money/exchange-rate-defaults";
import { canReadAppNotifications } from "../../lib/auth/notification-access";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../../modules/auth/AuthProvider";
import { ThemePicker } from "../../modules/theme/ThemeProvider";

export function PosLayout() {
  const { user } = useAuth();
  const canReceiveTransfers = hasPermission(user, "transfers.receive");
  const canReadNotifications = canReadAppNotifications(user);

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates-current"],
    queryFn: fetchCurrentExchangeRates,
    staleTime: 60_000,
  });
  const enc = ratesQuery.data?.encaissement?.rate ?? DEFAULT_ENCAISSEMENT_CDF_PER_USD;

  const workspaceQuery = useQuery({
    queryKey: ["pos-workspace"],
    queryFn: fetchPosWorkspace,
    enabled: canReadNotifications || canReceiveTransfers,
    staleTime: 60_000,
  });

  const alertStoreId =
    workspaceQuery.data?.primaryStoreId ?? user?.stores[0]?.id ?? null;

  const shippedAlertsQuery = useQuery({
    queryKey: ["notification-unread", "TRANSFER_SHIPPED", alertStoreId],
    queryFn: () =>
      fetchNotificationUnreadCount({
        storeId: alertStoreId!,
        type: "TRANSFER_SHIPPED",
      }),
    enabled: canReadNotifications && Boolean(alertStoreId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const internalIssueAlertsQuery = useQuery({
    queryKey: ["notification-unread", "INTERNAL_ISSUE_PENDING", alertStoreId],
    queryFn: () =>
      fetchNotificationUnreadCount({
        storeId: alertStoreId!,
        type: "INTERNAL_ISSUE_PENDING",
      }),
    enabled: canReadNotifications && Boolean(alertStoreId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const expenseAlertsQuery = useQuery({
    queryKey: ["notification-unread", "EXPENSE_DRAWER_PENDING", alertStoreId],
    queryFn: () =>
      fetchNotificationUnreadCount({
        storeId: alertStoreId!,
        type: "EXPENSE_DRAWER_PENDING",
      }),
    enabled: canReadNotifications && Boolean(alertStoreId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const transferAlertCount = shippedAlertsQuery.data?.count ?? 0;
  const internalIssueAlertCount = internalIssueAlertsQuery.data?.count ?? 0;
  const expenseAlertCount = expenseAlertsQuery.data?.count ?? 0;
  const bellCount = transferAlertCount + internalIssueAlertCount + expenseAlertCount;
  const bellHref =
    transferAlertCount > 0
      ? "/pos/receive-transfers?status=SHIPPED"
      : expenseAlertCount > 0
        ? "/pos/confirm-expenses"
        : internalIssueAlertCount > 0
          ? "/pos/confirm-internal-issues"
          : canReceiveTransfers
            ? "/pos/receive-transfers?status=SHIPPED"
            : "/pos";
  const bellTitle =
    transferAlertCount > 0
      ? "Transferts expédiés à réceptionner"
      : expenseAlertCount > 0
        ? "Dépenses tiroir à confirmer"
        : internalIssueAlertCount > 0
          ? "Sorties internes à confirmer"
          : canReceiveTransfers
            ? "Transferts expédiés à réceptionner"
            : "Notifications";

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-slate-100 to-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <EyanoLogo compact onLight />
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#f47a12] uppercase">Eyano</p>
              <p className="truncate text-sm font-semibold text-slate-900">Caisse &amp; ventes</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
              <ThemePicker compact />
              <span className="h-4 w-px bg-slate-200" aria-hidden />
              <p className="font-mono text-xs tabular-nums text-slate-600">1 USD = {formatCdfPerUsd(enc)} CDF</p>
            </div>
            <Link
              to={bellHref}
              className="relative grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label={bellTitle}
              title={bellTitle}
            >
              <BellIcon />
              {bellCount > 0 ? (
                <span
                  className={`absolute -top-1 -right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
                    internalIssueAlertCount > 0 && transferAlertCount === 0 ? "bg-amber-700" : "bg-emerald-700"
                  }`}
                >
                  {bellCount > 9 ? "9+" : bellCount}
                </span>
              ) : null}
            </Link>
            <SessionActions variant="cluster" onLight />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
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