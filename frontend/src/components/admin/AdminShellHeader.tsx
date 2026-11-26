import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchCurrentExchangeRates } from "../../lib/api/exchange-rates";
import { findNavItemByPath } from "../../lib/navigation/admin-nav";
import { DEFAULT_ENCAISSEMENT_CDF_PER_USD, formatCdfPerUsd } from "../../lib/money/exchange-rate-defaults";
import { LIVE_SYNC_STALE_TIME_MS } from "../../lib/query/live-sync";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../../modules/auth/AuthProvider";
import { AdminLiveSyncIndicator } from "./AdminLiveSyncIndicator";
import { AdminStockAlertsBell } from "./AdminStockAlertsBell";
import { EyanoLogo } from "../EyanoLogo";
import { SessionActions } from "../SessionActions";
import { ThemePicker } from "../../modules/theme/ThemeProvider";

type AdminShellHeaderProps = {
  onOpenMenu: () => void;
};

export function AdminShellHeader({ onOpenMenu }: AdminShellHeaderProps) {
  const { user } = useAuth();
  const location = useLocation();
  const current = useMemo(() => findNavItemByPath(location.pathname), [location.pathname]);
  const canPos = hasPermission(user, "sales.create") || hasPermission(user, "cash.session");

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates", "current"],
    queryFn: fetchCurrentExchangeRates,
    staleTime: LIVE_SYNC_STALE_TIME_MS,
  });

  const encRate = ratesQuery.data?.encaissement?.rate ?? DEFAULT_ENCAISSEMENT_CDF_PER_USD;

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            onClick={onOpenMenu}
            aria-label="Ouvrir le menu"
          >
            <MenuIcon />
          </button>
          <div className="lg:hidden">
            <EyanoLogo compact onLight />
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#f47a12] uppercase">Eyano</p>
            <p className="truncate text-sm font-semibold text-slate-900">{current?.label ?? "Administration"}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
            <ThemePicker compact />
            <span className="h-4 w-px bg-slate-200" aria-hidden />
            <p className="font-mono text-xs tabular-nums text-slate-600">
              1 USD = {formatCdfPerUsd(encRate)} CDF
            </p>
          </div>
          {canPos && location.pathname !== "/pos" ? (
            <Link
              to="/pos"
              className="hidden whitespace-nowrap rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 sm:inline-flex"
            >
              Caisse POS
            </Link>
          ) : null}
          <AdminLiveSyncIndicator />
          <AdminStockAlertsBell />
          <SessionActions variant="cluster" onLight />
        </div>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}