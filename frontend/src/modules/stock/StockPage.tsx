import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button, linkButtonClassName } from "../../components/ui/Button";
import { FormField, inputClassName, textareaClassName } from "../../components/ui/FormField";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchProducts } from "../../lib/api/products";
import { fetchStockLevels, fetchStockMovements, fetchStockSummary, postManualStockAdjustment, reconcileStock } from "../../lib/api/stock";
import { fetchStores } from "../../lib/api/stores";
import { fetchWarehouses } from "../../lib/api/warehouses";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { locationLabel, movementTypeLabel, stockAlertLabel, stockAlertTone } from "./stock-display";

type WorkspaceTab = "levels" | "movements";

export function StockPage() {
  const { user } = useAuth();
  const canAdjust = hasPermission(user, "stock.adjust");
  const isSuperAdmin = user?.role.code === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<WorkspaceTab>("levels");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [locationKind, setLocationKind] = useState<"ALL" | "WAREHOUSE" | "STORE">("ALL");
  const [alertStatus, setAlertStatus] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["stock-summary"],
    queryFn: fetchStockSummary,
  });

  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const storesQuery = useQuery({
    queryKey: ["stores-stock-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
  });

  const levelsQuery = useQuery({
    queryKey: ["stock-levels", page, search, locationKind, alertStatus, warehouseFilter, storeFilter],
    queryFn: () =>
      fetchStockLevels({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
        locationKind: locationKind === "ALL" ? undefined : locationKind,
        alertStatus: (alertStatus || undefined) as "OK" | "LOW" | "STOCKOUT" | undefined,
        warehouseId: warehouseFilter || undefined,
        storeId: storeFilter || undefined,
      }),
    enabled: tab === "levels",
  });

  const movementsQuery = useQuery({
    queryKey: ["stock-movements", page, search, warehouseFilter, storeFilter, movementTypeFilter],
    queryFn: () =>
      fetchStockMovements({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
        warehouseId: warehouseFilter || undefined,
        storeId: storeFilter || undefined,
        movementType: movementTypeFilter || undefined,
      }),
    enabled: tab === "movements",
  });

  const activeQuery = tab === "levels" ? levelsQuery : movementsQuery;
  const errorMessage = activeQuery.isError ? formatApiErrorMessage(activeQuery.error, "Chargement impossible.") : null;

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustWarehouseId, setAdjustWarehouseId] = useState("");
  const [adjustStoreId, setAdjustStoreId] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"IN" | "OUT">("IN");
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustProductSearch, setAdjustProductSearch] = useState("");
  const [adjustProductLabel, setAdjustProductLabel] = useState("");

  const adjustProductsQuery = useQuery({
    queryKey: ["stock-adjust-products", adjustProductSearch],
    queryFn: () =>
      fetchProducts({ page: 1, pageSize: 8, search: adjustProductSearch.trim() || undefined, status: "ACTIVE" }),
    enabled: adjustOpen && adjustProductSearch.trim().length >= 2,
  });

  const adjustMutation = useMutation({
    mutationFn: postManualStockAdjustment,
    onSuccess: async () => {
      pushToast({ tone: "success", message: "Mouvement enregistré." });
      setAdjustOpen(false);
      setAdjustNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-levels"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-summary"] }),
      ]);
    },
    onError: (error) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Échec du mouvement.") });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: () => reconcileStock(),
    onSuccess: (data) => {
      pushToast({
        tone: data.discrepancyCount === 0 ? "success" : "info",
        message:
          data.discrepancyCount === 0
            ? `Réconciliation OK — ${data.checked} lignes vérifiées.`
            : `${data.discrepancyCount} écart(s) journalisé(s) sur ${data.checked} lignes.`,
      });
    },
    onError: (error) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Réconciliation impossible.") });
    },
  });

  const summary = summaryQuery.data;
  const kpiCards = useMemo(
    () => [
      { label: "Lignes de solde", value: summary?.totalLevels ?? "—", tone: "neutral" as const },
      { label: "Confortables", value: summary?.ok ?? "—", tone: "success" as const },
      { label: "Sous seuil", value: summary?.low ?? "—", tone: "warning" as const },
      { label: "Ruptures", value: summary?.stockout ?? "—", tone: "warning" as const },
    ],
    [summary],
  );

  const tabClass = (value: WorkspaceTab) =>
    value === tab
      ? "rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200"
      : "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white/80 hover:text-slate-900";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stocks"
        title="Soldes & mouvements"
        description="Consultez les soldes par lieu et l’historique des mouvements (grand livre). Alertes seuil et rupture."
        actions={
          <div className="flex flex-wrap gap-2">
            {canAdjust ? (
              <Button type="button" onClick={() => setAdjustOpen((open) => !open)}>
                {adjustOpen ? "Fermer l’ajustement" : "Ajustement manuel"}
              </Button>
            ) : null}
            {isSuperAdmin ? (
              <Button
                type="button"
                variant="ghost"
                disabled={reconcileMutation.isPending}
                onClick={() => reconcileMutation.mutate()}
              >
                Réconciliation
              </Button>
            ) : null}
            <Link to="/admin/central-warehouse" className={linkButtonClassName}>
              Entrepôt central
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{kpi.value}</p>
            {kpi.tone !== "neutral" ? (
              <StatusBadge
                label={kpi.tone === "success" ? "Sain" : "Surveillance"}
                tone={kpi.tone === "success" ? "success" : "warning"}
              />
            ) : (
              <p className="mt-2 text-xs text-slate-500">Temps réel API</p>
            )}
          </article>
        ))}
      </section>

      {adjustOpen && canAdjust ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Ajustement manuel</h2>
          <p className="mt-1 text-sm text-slate-400">
            Réservé à <span className="font-mono text-xs">stock.adjust</span> — trace audit + mouvement{" "}
            <span className="font-mono text-xs">MANUAL_ADJUSTMENT</span>.
          </p>
          <form
            className="mt-4 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!adjustProductId.trim()) {
                pushToast({ tone: "error", message: "Sélectionnez un produit dans le catalogue." });
                return;
              }
              if (!adjustWarehouseId && !adjustStoreId) {
                pushToast({ tone: "error", message: "Choisissez un entrepôt ou une boutique." });
                return;
              }
              adjustMutation.mutate({
                productId: adjustProductId.trim(),
                warehouseId: adjustWarehouseId || undefined,
                storeId: adjustStoreId || undefined,
                direction: adjustDirection,
                quantity: adjustQty,
                note: adjustNote.trim(),
              });
            }}
          >
            <div className="md:col-span-2 space-y-2">
              <FormField
                label="Produit"
                htmlFor="adj-product-search"
                hint="Référence ou nom (min. 2 caractères)"
              >
                <input
                  id="adj-product-search"
                  value={adjustProductSearch}
                  onChange={(e) => setAdjustProductSearch(e.target.value)}
                  className={inputClassName}
                  placeholder="Rechercher…"
                />
              </FormField>
              {adjustProductLabel ? (
                <p className="text-sm text-emerald-700">
                  Sélectionné : <span className="font-mono">{adjustProductLabel}</span>
                </p>
              ) : null}
              {adjustProductsQuery.data?.items.length ? (
                <ul className="rounded-lg border border-slate-200 bg-white text-sm">
                  {adjustProductsQuery.data.items.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100"
                        onClick={() => {
                          setAdjustProductId(product.id);
                          setAdjustProductLabel(`${product.reference} — ${product.name}`);
                          setAdjustProductSearch("");
                        }}
                      >
                        <span>
                          <span className="font-mono text-slate-400">{product.reference}</span> — {product.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <FormField label="Sens" htmlFor="adj-direction">
              <select
                id="adj-direction"
                value={adjustDirection}
                onChange={(e) => setAdjustDirection(e.target.value as "IN" | "OUT")}
                className={inputClassName}
              >
                <option value="IN">Entrée (IN)</option>
                <option value="OUT">Sortie (OUT)</option>
              </select>
            </FormField>
            <FormField label="Entrepôt" htmlFor="adj-wh">
              <select
                id="adj-wh"
                value={adjustWarehouseId}
                onChange={(e) => {
                  setAdjustWarehouseId(e.target.value);
                  if (e.target.value) setAdjustStoreId("");
                }}
                className={inputClassName}
              >
                <option value="">—</option>
                {(warehousesQuery.data?.items ?? []).map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Boutique" htmlFor="adj-store">
              <select
                id="adj-store"
                value={adjustStoreId}
                onChange={(e) => {
                  setAdjustStoreId(e.target.value);
                  if (e.target.value) setAdjustWarehouseId("");
                }}
                className={inputClassName}
              >
                <option value="">—</option>
                {(storesQuery.data?.items ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} — {store.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantité" htmlFor="adj-qty">
              <input
                id="adj-qty"
                type="number"
                min={1}
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
                className={inputClassName}
              />
            </FormField>
            <FormField label="Justification" htmlFor="adj-note" className="md:col-span-2">
              <textarea
                id="adj-note"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                className={textareaClassName}
                rows={2}
                required
                placeholder="Motif opérationnel obligatoire"
              />
            </FormField>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="submit" disabled={adjustMutation.isPending}>
                Valider le mouvement
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {tab === "levels" ? "Soldes par lieu" : "Historique des mouvements"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {tab === "levels"
                ? "Quantités disponibles, réservées et alertes par entrepôt ou boutique."
                : "Grand livre des entrées et sorties — filtres par lieu, type et article."}
            </p>
          </div>
          <div className="flex gap-2 rounded-lg bg-slate-100/80 p-1.5">
            <button type="button" className={tabClass("levels")} onClick={() => { setTab("levels"); setPage(1); }}>
              Soldes par lieu
            </button>
            <button type="button" className={tabClass("movements")} onClick={() => { setTab("movements"); setPage(1); }}>
              Historique des mouvements
            </button>
          </div>
        </header>

        <div className="p-4">
        <div
          className={
            tab === "levels"
              ? "grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4"
              : "grid grid-cols-2 gap-x-3 gap-y-2 min-[1100px]:flex min-[1100px]:items-end min-[1100px]:gap-3"
          }
        >
          <label
            className={`min-w-0 ${tab === "levels" ? "sm:col-span-2 lg:col-span-2" : "col-span-2 min-[1100px]:flex-1 min-[1100px]:col-span-1"}`}
          >
            <span className={filterLabelClassName}>Recherche article</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Référence ou libellé…"
              className={filterInputClassName}
            />
          </label>
          {tab === "levels" ? (
            <>
              <label className="min-w-0">
                <span className={filterLabelClassName}>Type de lieu</span>
                <select
                  value={locationKind}
                  onChange={(e) => {
                    setLocationKind(e.target.value as typeof locationKind);
                    setPage(1);
                  }}
                  className={filterInputClassName}
                >
                  <option value="ALL">Tous</option>
                  <option value="WAREHOUSE">Entrepôts</option>
                  <option value="STORE">Boutiques</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className={filterLabelClassName}>Alerte</span>
                <select
                  value={alertStatus}
                  onChange={(e) => {
                    setAlertStatus(e.target.value);
                    setPage(1);
                  }}
                  className={filterInputClassName}
                >
                  <option value="">Toutes</option>
                  <option value="OK">Confortable</option>
                  <option value="LOW">Sous seuil</option>
                  <option value="STOCKOUT">Rupture</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="min-w-0 min-[1100px]:flex-1">
                <span className={filterLabelClassName}>Entrepôt</span>
                <select
                  value={warehouseFilter}
                  onChange={(e) => {
                    setWarehouseFilter(e.target.value);
                    setStoreFilter("");
                    setPage(1);
                  }}
                  className={filterInputClassName}
                >
                  <option value="">Tous</option>
                  {(warehousesQuery.data?.items ?? []).map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 min-[1100px]:flex-1">
                <span className={filterLabelClassName}>Boutique</span>
                <select
                  value={storeFilter}
                  onChange={(e) => {
                    setStoreFilter(e.target.value);
                    setWarehouseFilter("");
                    setPage(1);
                  }}
                  className={filterInputClassName}
                >
                  <option value="">Toutes</option>
                  {(storesQuery.data?.items ?? []).map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 col-span-2 min-[1100px]:flex-1 min-[1100px]:col-span-1">
                <span className={filterLabelClassName}>Type de mouvement</span>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => {
                    setMovementTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className={filterInputClassName}
                >
                  <option value="">Tous</option>
                  <option value="GOODS_RECEIPT">Réception fournisseur</option>
                  <option value="MANUAL_ADJUSTMENT">Ajustement manuel</option>
                  <option value="TRANSFER_IN">Transfert — entrée</option>
                  <option value="TRANSFER_OUT">Transfert — sortie</option>
                  <option value="SALE">Vente</option>
                  <option value="SALE_REVERSAL">Annulation vente</option>
                  <option value="INTERNAL_ISSUE">Sortie interne</option>
                  <option value="INVENTORY_ADJUSTMENT">Inventaire</option>
                </select>
              </label>
            </>
          )}
        </div>

        {tab === "levels" ? (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-2">
            {(levelsQuery.data?.items ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs leading-snug text-slate-900">
                    <Link
                      to={`/admin/products/${row.product.id}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {row.product.reference}
                    </Link>{" "}
                    <span className="text-slate-500">— {row.product.name}</span>
                  </p>
                  <p className="text-[11px] leading-snug text-slate-500">
                    {locationLabel(row)} · dispo {row.quantityAvailable} / {row.quantityOnHand} (réserve{" "}
                    {row.quantityReserved}) · seuil {row.effectiveThreshold}
                  </p>
                </div>
                <StatusBadge
                  compact
                  label={stockAlertLabel(row.alertStatus)}
                  tone={stockAlertTone(row.alertStatus)}
                />
              </li>
            ))}
            {(levelsQuery.data?.items.length ?? 0) === 0 && !levelsQuery.isLoading ? (
              <li className="py-10 text-center text-sm text-slate-500">Aucun solde pour ce filtre.</li>
            ) : null}
          </ul>
        ) : (
          <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-2">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Produit</th>
                  <th className="px-3 py-2.5 font-medium">Lieu</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Variation</th>
                  <th className="px-3 py-2.5 font-medium">Auteur / note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(movementsQuery.data?.items ?? []).map((row) => {
                  const signed = row.direction === "IN" ? row.quantity : -row.quantity;
                  return (
                    <tr key={row.id} className="text-slate-700">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-500">
                        {new Date(row.occurredAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-slate-500">{row.product.reference}</span>
                        <span className="ml-1 font-medium text-slate-900">{row.product.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{locationLabel(row)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{movementTypeLabel(row.movementType)}</td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          signed >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {signed > 0 ? `+${signed}` : signed}
                      </td>
                      <td className="max-w-xs px-3 py-2.5 text-slate-500">
                        {row.createdBy.firstName} {row.createdBy.lastName}
                        {row.note ? ` · ${row.note}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(movementsQuery.data?.items.length ?? 0) === 0 && !movementsQuery.isLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">Aucun mouvement pour ce filtre.</p>
            ) : null}
          </div>
        )}

        {activeQuery.data ? (
          <div className="mt-4">
            <Pagination
              page={activeQuery.data.page}
              totalPages={activeQuery.data.totalPages}
              totalItems={activeQuery.data.total}
              onPageChange={setPage}
            />
          </div>
        ) : null}
        </div>
      </section>
    </div>
  );
}