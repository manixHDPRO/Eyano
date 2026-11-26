import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { renderNavIcon } from "../../components/admin/AdminNavIcons";
import { Pagination } from "../../components/ui/Pagination";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  createInventory,
  fetchInventories,
  fetchInventoryLocations,
  startInventory,
} from "../../lib/api/inventories";
import type { InventoryListItem, InventoryLocationOption, InventoryScopeType } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { InventorySessionPanel } from "./InventorySessionPanel";
import { inventorySessionDateLines, inventoryStatusLabel, locationLabel } from "./inventory-status";

function locationKeyFromOption(option: InventoryLocationOption): string {
  if (option.scopeType === "WAREHOUSE" && option.warehouse) {
    return `w:${option.warehouse.id}`;
  }
  if (option.store) {
    return `s:${option.store.id}`;
  }
  return "";
}

export function InventoriesListPage() {
  const { id: routeSessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { user } = useAuth();
  const canConduct = hasPermission(user, "inventory.conduct");
  const canRead = hasPermission(user, "inventory.conduct") || hasPermission(user, "inventory.validate");

  const [selectedId, setSelectedId] = useState<string | null>(routeSessionId ?? null);
  const [locationKey, setLocationKey] = useState("");
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    if (routeSessionId) {
      setSelectedId(routeSessionId);
    }
  }, [routeSessionId]);

  const listQuery = useQuery({
    queryKey: ["inventories", "workspace", listPage],
    queryFn: () => fetchInventories({ page: listPage, pageSize: 15 }),
    enabled: canRead,
  });

  const locationsQuery = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: fetchInventoryLocations,
    enabled: canConduct,
  });

  useEffect(() => {
    const items = locationsQuery.data?.items ?? [];
    if (!locationKey && items.length > 0) {
      setLocationKey(locationKeyFromOption(items[0]));
    }
  }, [locationsQuery.data, locationKey]);

  const selectedLocation = useMemo(() => {
    const items = locationsQuery.data?.items ?? [];
    return items.find((row) => locationKeyFromOption(row) === locationKey);
  }, [locationsQuery.data, locationKey]);

  const sessions = listQuery.data?.items ?? [];
  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;

  const openMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocation) {
        throw new Error("Choisissez un lieu d'inventaire.");
      }
      const payload =
        selectedLocation.scopeType === "WAREHOUSE"
          ? {
              scopeType: "WAREHOUSE" as InventoryScopeType,
              warehouseId: selectedLocation.warehouse!.id,
            }
          : {
              scopeType: "STORE" as InventoryScopeType,
              storeId: selectedLocation.store!.id,
            };
      const created = await createInventory(payload);
      return startInventory(created.id);
    },
    onSuccess: async (started) => {
      await queryClient.invalidateQueries({ queryKey: ["inventories"] });
      await queryClient.invalidateQueries({ queryKey: ["inventories-summary"] });
      setSelectedId(started.id);
      navigate(`/admin/inventories/${started.id}`, { replace: true });
      pushToast({
        tone: "success",
        message: `Session d'inventaire ${started.reference} ouverte.`,
      });
    },
    onError: (error) =>
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Ouverture impossible.") }),
  });

  function selectSession(session: InventoryListItem) {
    setSelectedId(session.id);
    navigate(`/admin/inventories/${session.id}`, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventaires administratifs</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Rapprochement stock théorique vs comptage physique avec justification obligatoire sur chaque écart.
          </p>
        </div>
      </div>

      {canConduct ? (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-slate-700">{renderNavIcon("inventories", "size-5")}</span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Ouvrir une nouvelle session d&apos;inventaire administratif
              </h2>
              <p className="text-xs text-slate-500">Réservé au personnel administratif autorisé.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={locationKey}
              onChange={(event) => setLocationKey(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              {(locationsQuery.data?.items ?? []).map((option) => (
                <option key={locationKeyFromOption(option)} value={locationKeyFromOption(option)}>
                  {option.scopeType === "WAREHOUSE"
                    ? `Entrepôt — ${option.warehouse?.name ?? option.warehouse?.code}`
                    : option.store?.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!locationKey || openMutation.isPending}
              onClick={() => openMutation.mutate()}
              className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Ouvrir inventaire
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Sessions d&apos;inventaire</h3>
          {listQuery.isLoading ? (
            <p className="py-6 text-center text-xs text-slate-500">Chargement…</p>
          ) : sessions.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Aucune session ouverte.</p>
          ) : (
            sessions.map((session) => {
              const { start: startLabel, end: endLabel } = inventorySessionDateLines(session);
              return (
              <button
                key={session.id}
                type="button"
                onClick={() => selectSession(session)}
                className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                  selectedId === session.id
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between font-semibold text-slate-900">
                  <span className="font-mono">{session.reference}</span>
                  <span>{inventoryStatusLabel(session.status)}</span>
                </div>
                <div className="mt-0.5 text-slate-500">{locationLabel(session)}</div>
                {startLabel ? (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Début {startLabel}
                    {endLabel ? ` · Fin ${endLabel}` : ""}
                  </p>
                ) : null}
              </button>
            );
            })
          )}
          {listQuery.data ? (
            <div className="border-t border-slate-200 pt-3">
              <Pagination
                page={listQuery.data.page}
                totalPages={listQuery.data.totalPages}
                totalItems={listQuery.data.total}
                onPageChange={setListPage}
                itemLabel="sessions"
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-8">
          {!selectedId ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Sélectionnez une session d&apos;inventaire à gauche pour saisir le comptage physique.
            </div>
          ) : (
            <InventorySessionPanel
              sessionId={selectedId}
              onUpdated={() => listQuery.refetch()}
            />
          )}
        </div>
      </div>
    </div>
  );
}