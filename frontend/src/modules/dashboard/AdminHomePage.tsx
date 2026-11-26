import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusBadge } from "../../components/StatusBadge";
import { ApiError } from "../../lib/api/errors";
import { fetchAdminDashboard } from "../../lib/api/dashboard";
import { fetchHealth } from "../../lib/api/health";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { hasPermission } from "../../lib/auth/permissions";
import { formatCdfPerUsd } from "../../lib/money/exchange-rate-defaults";
import { useAuth } from "../auth/AuthProvider";
import { formatUsd } from "../catalog/money";
import { transferStatusLabel } from "../transfers/transfer-status";
import {
  formatRecentSaleAmount,
  formatRecentSalePayment,
  resolveDashboardRates,
} from "./dashboard-display";
import {
  AlertIcon,
  ArrowRightIcon,
  PackageIcon,
  StoreIcon,
  TrendingUpIcon,
  WalletIcon,
} from "./DashboardIcons";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { DashboardTodayExpensesSection } from "./DashboardTodayExpensesSection";
import { useDashboardTheme } from "./DashboardTheme";
import { usePresentation } from "../presentation/PresentationProvider";
import type { DashboardModelId } from "../presentation/presentation";
import type { AdminDashboardPayload } from "../../lib/api/dashboard";

export function AdminHomePage() {
  const { themeId, theme } = useDashboardTheme();
  const { dashboard } = usePresentation();
  const { user } = useAuth();
  const canStock = hasPermission(user, "stock.read");
  const canTransfers =
    hasPermission(user, "transfers.create") ||
    hasPermission(user, "transfers.validate") ||
    hasPermission(user, "transfers.prepare_ship");
  const canReports = hasPermission(user, "reports.read");
  const canExpenses = hasPermission(user, "expenses.manage") || hasPermission(user, "reports.read");
  const canManageExpenses = hasPermission(user, "expenses.manage");
  const canPos = hasPermission(user, "sales.create") || hasPermission(user, "cash.session");

  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminDashboard,
    refetchInterval: 60_000,
  });

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const apiTone =
    healthQuery.data?.status === "ok" ? "success" : healthQuery.isError ? "warning" : "neutral";

  const apiLabel = healthQuery.isLoading
    ? "Vérification…"
    : healthQuery.isError
      ? healthQuery.error instanceof ApiError
        ? healthQuery.error.message
        : "API injoignable"
      : healthQuery.data?.status === "ok"
        ? `API v${healthQuery.data.version}`
        : "API dégradée";

  if (dashboardQuery.isLoading) {
    return (
      <DashboardFrame themeId={themeId} styleId={dashboard}>
        <DashboardSkeleton />
      </DashboardFrame>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <DashboardFrame themeId={themeId} styleId={dashboard}>
        <div className="dash-card p-6 text-sm dash-danger">
          {formatApiErrorMessage(dashboardQuery.error, "Impossible de charger les données du tableau de bord.")}
        </div>
      </DashboardFrame>
    );
  }

  const data = dashboardQuery.data;
  const { kpis } = data;
  const { encaissementRate, decaissementRate } = resolveDashboardRates(data);
  const showWarehouse = kpis.warehouseValueUsd !== null;

  return (
    <DashboardFrame themeId={themeId} styleId={dashboard}>
      <div className="dash-hero flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase dash-accent-text">Tableau de bord</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Administration centrale</h1>
          <p className="mt-1 text-sm dash-muted">
            Vue consolidée multi-boutiques
            {showWarehouse ? " · Entrepôt central" : ""}
            {" · "}
            Taux actif :{" "}
            <span className="font-mono font-medium dash-text">{formatCdfPerUsd(encaissementRate)} CDF</span>{" "}
            (encaissement) /{" "}
            <span className="font-mono font-medium dash-text">{formatCdfPerUsd(decaissementRate)} CDF</span>{" "}
            (décaissement)
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge label={apiLabel} tone={apiTone} />
            {healthQuery.data?.database.status === "up" ? (
              <span className="text-xs dash-muted">
                PostgreSQL — {healthQuery.data.database.latencyMs ?? "—"} ms
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
            {canTransfers ? (
              <Link
                to="/admin/transfers"
                className="dash-btn whitespace-nowrap px-4 py-2 text-xs font-medium"
              >
                Nouveau transfert
              </Link>
            ) : null}
            {canPos ? (
              <Link
                to="/pos"
                className="dash-btn-primary inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-semibold"
              >
                Ouvrir Caisse POS
                <ArrowRightIcon />
              </Link>
            ) : null}
        </div>
      </div>

      <DashboardModel
        model={dashboard}
        data={data}
        theme={theme}
        canStock={canStock}
        canTransfers={canTransfers}
        canReports={canReports}
        canExpenses={canExpenses}
        canManageExpenses={canManageExpenses}
      />
    </DashboardFrame>
  );
}

function DashboardModel({
  model,
  data,
  theme,
  canStock,
  canTransfers,
  canReports,
  canExpenses,
  canManageExpenses,
}: {
  model: DashboardModelId;
  data: AdminDashboardPayload;
  theme: ReturnType<typeof useDashboardTheme>["theme"];
  canStock: boolean;
  canTransfers: boolean;
  canReports: boolean;
  canExpenses: boolean;
  canManageExpenses: boolean;
}) {
  const { kpis, salesByStore, lowStockAlerts, recentSales, recentTransfers } = data;
  const showWarehouse = kpis.warehouseValueUsd !== null;

  switch (model) {
    case "pilotage":
    case "glace":
      return (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Chiffre d'affaires global"
              icon={<TrendingUpIcon className="dash-faint" />}
              value={formatUsd(kpis.totalSalesUsd)}
              hint={`${kpis.salesCount} vente(s) · Remises : ${formatUsd(kpis.totalDiscountsUsd)}`}
            />
            <KpiCard
              label={showWarehouse ? "Valorisation entrepôt" : "Stock réseau (unités)"}
              icon={<PackageIcon className="dash-faint" />}
              value={showWarehouse ? formatUsd(kpis.warehouseValueUsd ?? 0) : `${formatUnits(networkStockUnits(kpis, salesByStore))} u.`}
              hint={
                showWarehouse
                  ? `${formatUnits(kpis.totalWarehouseUnits ?? 0)} unités en stock central`
                  : "Somme des unités en boutiques de votre périmètre"
              }
            />
            <KpiCard
              label="Réseau boutiques"
              icon={<StoreIcon className="dash-faint" />}
              value={`${kpis.activeStoresCount} boutiques`}
              hint="Établissements actifs dans votre périmètre"
            />
            <KpiCard
              label="Alertes stock & ruptures"
              icon={<AlertIcon className="dash-warn" />}
              value={`${kpis.lowStockCount} alerte(s)`}
              hint={<span className="dash-danger">Dont {kpis.stockoutCount} rupture(s) totale(s) (stock = 0)</span>}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <StoreChart data={salesByStore} theme={theme} canReports={canReports} />
            </div>
            <div className="lg:col-span-5">
              <AlertsPanel alerts={lowStockAlerts} canStock={canStock} />
            </div>
          </div>
          {canExpenses ? (
            <DashboardTodayExpensesSection todayExpenses={data.todayExpenses} canManage={canManageExpenses} />
          ) : null}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SalesPanel sales={recentSales} />
            <TransfersPanel transfers={recentTransfers} canTransfers={canTransfers} />
          </div>
        </>
      );
    case "jour":
      return (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Sessions de caisse ouvertes"
              icon={<WalletIcon className="dash-faint" />}
              value={String(kpis.openCashSessions)}
              hint="Sessions encore ouvertes dans le périmètre"
            />
            <KpiCard
              label="Dépenses du jour"
              icon={<AlertIcon className="dash-faint" />}
              value={formatUsd(data.todayExpenses.summary.amountUsd)}
              hint={`${data.todayExpenses.summary.count} dépense(s) enregistrée(s) aujourd’hui`}
            />
            <KpiCard
              label="Chiffre d'affaires"
              icon={<TrendingUpIcon className="dash-faint" />}
              value={formatUsd(kpis.totalSalesUsd)}
              hint={`${kpis.salesCount} vente(s) au total`}
            />
            <KpiCard
              label="Dépenses"
              icon={<PackageIcon className="dash-faint" />}
              value={formatUsd(kpis.totalExpensesUsd)}
              hint="Total des charges du périmètre"
            />
          </div>
          <SalesPanel sales={recentSales} />
          {canExpenses ? (
            <DashboardTodayExpensesSection todayExpenses={data.todayExpenses} canManage={canManageExpenses} />
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/cash-sessions" className="dash-btn px-4 py-2 text-xs font-medium">
              Sessions de caisse
            </Link>
            <Link to="/admin/payments" className="dash-btn px-4 py-2 text-xs font-medium">
              Encaissements
            </Link>
          </div>
        </>
      );
    case "stock":
      return (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Ruptures"
              icon={<AlertIcon className="dash-warn" />}
              value={String(kpis.stockoutCount)}
              hint="Produits à stock nul"
            />
            <KpiCard
              label="Sous le seuil"
              icon={<AlertIcon className="dash-faint" />}
              value={String(kpis.lowStockCount)}
              hint="Alertes de réapprovisionnement"
            />
            <KpiCard
              label="Transferts en cours"
              icon={<StoreIcon className="dash-faint" />}
              value={String(kpis.pendingTransfersCount)}
              hint="Entrepôt vers boutiques"
            />
            <KpiCard
              label={showWarehouse ? "Unités entrepôt" : "Unités réseau"}
              icon={<PackageIcon className="dash-faint" />}
              value={formatUnits(showWarehouse ? (kpis.totalWarehouseUnits ?? 0) : networkStockUnits(kpis, salesByStore))}
              hint={showWarehouse ? "Stock central" : "Unités des boutiques du périmètre"}
            />
          </div>
          <AlertsPanel alerts={lowStockAlerts} canStock={canStock} />
          <TransfersPanel transfers={recentTransfers} canTransfers={canTransfers} />
          <StoreChart data={salesByStore} theme={theme} canReports={canReports} />
        </>
      );
    case "atelier":
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <article className="dash-card dash-feature flex flex-col justify-between p-6 lg:col-span-7">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase dash-accent-text">Chiffre d&apos;affaires</p>
            <p className="mt-4 font-mono text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
              {formatUsd(kpis.totalSalesUsd)}
            </p>
            <p className="mt-3 text-sm dash-muted">
              {kpis.salesCount} vente(s) · Remises {formatUsd(kpis.totalDiscountsUsd)}
            </p>
          </article>
          <div className="grid gap-4 lg:col-span-5">
            <KpiCard
              label="Réseau boutiques"
              icon={<StoreIcon className="dash-faint" />}
              value={`${kpis.activeStoresCount} boutiques`}
              hint="Établissements actifs dans votre périmètre"
            />
            <KpiCard
              label="Alertes stock"
              icon={<AlertIcon className="dash-warn" />}
              value={`${kpis.lowStockCount} alerte(s)`}
              hint={<span className="dash-danger">{kpis.stockoutCount} rupture(s)</span>}
            />
          </div>
          <div className="lg:col-span-8">
            <StoreChart data={salesByStore} theme={theme} canReports={canReports} />
          </div>
          <div className="lg:col-span-4">
            <AlertsPanel alerts={lowStockAlerts} canStock={canStock} />
          </div>
          <div className="lg:col-span-6">
            <SalesPanel sales={recentSales} />
          </div>
          <div className="lg:col-span-6">
            <TransfersPanel transfers={recentTransfers} canTransfers={canTransfers} />
          </div>
        </div>
      );
    default: {
      const unknown: never = model;
      return unknown;
    }
  }
}

function StoreChart({
  data,
  theme,
  canReports,
}: {
  data: AdminDashboardPayload["salesByStore"];
  theme: ReturnType<typeof useDashboardTheme>["theme"];
  canReports: boolean;
}) {
  return (
    <section className="dash-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Performance et stock par boutique</h2>
          <p className="text-xs dash-muted">Ventes encaissées (USD) et unités disponibles par établissement</p>
        </div>
        {canReports ? (
          <Link to="/admin/sales" className="dash-link whitespace-nowrap text-xs">
            Voir historique ventes
          </Link>
        ) : null}
      </div>
      {data.length === 0 ? (
        <p className="py-16 text-center text-xs dash-muted">Aucune boutique active dans votre périmètre.</p>
      ) : (
        <>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 12, fill: theme.tick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.tick }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: `1px solid ${theme.tooltipBorder}`,
                    background: theme.tooltipBg,
                    color: theme.tooltipText,
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="revenueUsd" name="Ventes (USD)" fill={theme.chartRevenue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="stockUnits" name="Unités en stock" fill={theme.chartStock} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 border-t dash-line pt-4 sm:grid-cols-3">
            {data.map((store) => (
              <div key={store.storeId} className="text-xs">
                <div className="truncate font-semibold">{store.name}</div>
                <div className="mt-0.5 font-mono tabular-nums dash-muted">
                  {formatUsd(store.revenueUsd)} · {store.stockUnits} u.
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function AlertsPanel({
  alerts,
  canStock,
}: {
  alerts: AdminDashboardPayload["lowStockAlerts"];
  canStock: boolean;
}) {
  return (
    <section className="dash-card flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Alertes de réapprovisionnement</h2>
          <p className="text-xs dash-muted">Produits sous le seuil configuré</p>
        </div>
        {canStock ? (
          <Link to="/admin/central-warehouse" className="dash-link whitespace-nowrap text-xs">
            Entrepôt
          </Link>
        ) : null}
      </div>
      <DashboardLowStockAlertsTable alerts={alerts} />
      {canStock && alerts.length > 0 ? (
        <Link to="/admin/stock?alertStatus=LOW" className="dash-link mt-3 text-xs">
          Voir toutes les alertes dans Soldes & mouvements →
        </Link>
      ) : null}
    </section>
  );
}

function SalesPanel({ sales }: { sales: AdminDashboardPayload["recentSales"] }) {
  return (
    <section className="dash-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Dernières ventes</h2>
        <WalletIcon className="dash-faint" />
      </div>
      {sales.length === 0 ? (
        <div className="py-8 text-center text-xs dash-muted">
          Aucune vente enregistrée pour le moment. Ouvrez une session dans Caisse POS pour encaisser.
        </div>
      ) : (
        <DashboardRecentSalesTable sales={sales} />
      )}
    </section>
  );
}

function TransfersPanel({
  transfers,
  canTransfers,
}: {
  transfers: AdminDashboardPayload["recentTransfers"];
  canTransfers: boolean;
}) {
  return (
    <section className="dash-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Transferts récents</h2>
        {canTransfers ? (
          <Link to="/admin/transfers" className="dash-link text-xs">
            Gérer les transferts
          </Link>
        ) : null}
      </div>
      {transfers.length === 0 ? (
        <div className="py-8 text-center text-xs dash-muted">Aucun transfert entrepôt → boutique enregistré.</div>
      ) : (
        <DashboardRecentTransfersTable transfers={transfers} />
      )}
    </section>
  );
}

function DashboardFrame({
  themeId,
  styleId,
  children,
}: {
  themeId: ReturnType<typeof useDashboardTheme>["themeId"];
  styleId: DashboardModelId;
  children: ReactNode;
}) {
  return (
    <div
      className="dash -mx-4 -my-6 min-h-[calc(100dvh-3.5rem)] px-4 py-6 lg:-mx-8 lg:-my-8 lg:px-8 lg:py-8"
      data-theme={themeId}
      data-style={styleId}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">{children}</div>
    </div>
  );
}

type LowStockAlert = AdminDashboardPayload["lowStockAlerts"][number];
type RecentSale = AdminDashboardPayload["recentSales"][number];
type RecentTransfer = AdminDashboardPayload["recentTransfers"][number];

function DashboardLowStockAlertsTable({ alerts }: { alerts: LowStockAlert[] }) {
  const { page, setPage, slice, totalPages, totalItems } = useClientPagination(alerts, 10);

  return (
    <>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b dash-line dash-muted">
              <th className="py-2 font-medium">Produit</th>
              <th className="py-2 font-medium">Site</th>
              <th className="py-2 text-right font-medium">Stock</th>
              <th className="py-2 text-right font-medium">État</th>
            </tr>
          </thead>
          <tbody className="dash-divide">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center dash-muted">
                  Aucune alerte de stock faible actuellement.
                </td>
              </tr>
            ) : (
              slice.map((alert) => (
                <tr key={`${alert.productId}-${alert.locationName}`} className="dash-row">
                  <td className="py-2.5 pr-2">
                    <div className="max-w-[140px] truncate font-medium">{alert.name}</div>
                    <div className="font-mono text-[11px] dash-faint">{alert.reference}</div>
                  </td>
                  <td className="max-w-[110px] truncate py-2.5 dash-muted">{alert.locationName}</td>
                  <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                    {alert.quantity}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right">
                    {alert.quantity <= 0 ? (
                      <span className="dash-danger">Rupture</span>
                    ) : (
                      <span className="dash-warn">Seuil ≤ {alert.threshold}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {alerts.length > 0 ? (
        <div className="mt-3 border-t dash-line pt-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
            itemLabel="alertes"
          />
        </div>
      ) : null}
    </>
  );
}

function DashboardRecentSalesTable({ sales }: { sales: RecentSale[] }) {
  const { page, setPage, slice, totalPages, totalItems } = useClientPagination(sales, 10);

  return (
    <>
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b dash-line dash-muted">
            <th className="py-2 font-medium">N° Vente</th>
            <th className="py-2 font-medium">Paiement</th>
            <th className="py-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody className="dash-divide">
          {slice.map((sale) => (
            <tr key={sale.id} className="dash-row">
              <td className="py-2.5">
                <Link to={`/admin/sales/${sale.id}`} className="font-mono font-medium dash-text hover:underline">
                  {sale.saleNumber}
                </Link>
              </td>
              <td className="py-2.5 dash-muted">{formatRecentSalePayment(sale.paymentMethod, sale.currency)}</td>
              <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                {formatRecentSaleAmount(sale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 border-t dash-line pt-3">
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          itemLabel="ventes"
        />
      </div>
    </>
  );
}

function DashboardRecentTransfersTable({ transfers }: { transfers: RecentTransfer[] }) {
  const { page, setPage, slice, totalPages, totalItems } = useClientPagination(transfers, 10);

  return (
    <>
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b dash-line dash-muted">
            <th className="py-2 font-medium">N° Transfert</th>
            <th className="py-2 font-medium">Statut</th>
            <th className="py-2 text-right font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="dash-divide">
          {slice.map((transfer) => (
            <tr key={transfer.id} className="dash-row">
              <td className="py-2.5">
                <Link
                  to={`/admin/transfers/${transfer.id}`}
                  className="font-mono font-medium dash-text hover:underline"
                >
                  {transfer.transferNumber}
                </Link>
              </td>
              <td className="py-2.5 dash-muted">{transferStatusLabel(transfer.status)}</td>
              <td className="py-2.5 text-right font-mono dash-faint">
                {new Date(transfer.createdAt).toLocaleDateString("fr-FR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 border-t dash-line pt-3">
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          itemLabel="transferts"
        />
      </div>
    </>
  );
}

function KpiCard({
  label,
  icon,
  value,
  hint,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  hint: ReactNode;
}) {
  return (
    <article className="dash-card dash-kpi p-5">
      <span className="dash-kpi-bar" aria-hidden />
      <div className="flex items-center justify-between text-xs font-medium dash-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2.5 font-mono text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1.5 text-xs tabular-nums dash-muted">{hint}</div>
    </article>
  );
}

function formatUnits(value: number): string {
  return value.toLocaleString("fr-FR");
}

function networkStockUnits(
  kpis: { totalWarehouseUnits: number | null },
  salesByStore: { stockUnits: number }[],
): number {
  if (kpis.totalWarehouseUnits !== null) {
    return kpis.totalWarehouseUnits;
  }
  return salesByStore.reduce((acc, row) => acc + row.stockUnits, 0);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-card h-20 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="dash-card h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="dash-card h-80 animate-pulse lg:col-span-7" />
        <div className="dash-card h-80 animate-pulse lg:col-span-5" />
      </div>
      <div className="dash-card h-48 animate-pulse" />
    </div>
  );
}