import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { Pagination } from "../../components/ui/Pagination";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import type { ReferentialStatus, StoreListItem } from "../../lib/api/types";
import { fetchStores, updateStore } from "../../lib/api/stores";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { referentialStatusLabel, referentialStatusTone } from "./referential-status";
import { NewStoreModal } from "./NewStoreModal";

type StatusFilter = "" | ReferentialStatus;

type StoresListLocationState = {
  openNewStore?: boolean;
};

export function StoresListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [showStoreModal, setShowStoreModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = hasPermission(user, "stores.manage");
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const trimmedSearch = search.trim();

  const storesQuery = useQuery({
    queryKey: ["stores", page, trimmedSearch, status],
    queryFn: () =>
      fetchStores({
        page,
        pageSize: 12,
        search: trimmedSearch || undefined,
        status: status || undefined,
      }),
  });

  const errorMessage = storesQuery.isError ? formatApiErrorMessage(storesQuery.error, "Chargement impossible.") : null;
  const items = storesQuery.data?.items ?? [];
  const stats = storesQuery.data?.stats;

  useEffect(() => {
    const state = location.state as StoresListLocationState | null;
    if (!state?.openNewStore) {
      return;
    }
    setShowStoreModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const toggleMutation = useMutation({
    mutationFn: (store: StoreListItem) =>
      updateStore(store.id, {
        status: store.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    onSuccess: async (_data, store) => {
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      pushToast({
        tone: "success",
        message:
          store.status === "ACTIVE"
            ? `Boutique ${store.code} désactivée.`
            : `Boutique ${store.code} réactivée.`,
      });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Mise à jour impossible.") });
    },
  });

  const emptyHint = useMemo(() => {
    if (trimmedSearch || status) {
      return "Aucune boutique ne correspond à ces filtres.";
    }
    return "Créez le premier point de vente du réseau.";
  }, [status, trimmedSearch]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Boutiques</h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            Points de vente du réseau — fiche, ticket et caisses par magasin.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setShowStoreModal(true)}>
            <PlusIcon />
            Nouvelle boutique
          </Button>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Actives" value={stats?.active} hint="En service" />
        <Kpi label="Inactives" value={stats?.inactive} hint="Hors service" />
        <Kpi label="Caisses" value={stats?.cashRegisters} hint="Terminaux POS" />
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
            <label className="sm:col-span-7">
              <span className={filterLabelClassName}>Recherche</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Code, nom, ville…"
                className={filterInputClassName}
              />
            </label>
            <label className="sm:col-span-5">
              <span className={filterLabelClassName}>Statut</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes</option>
                <option value="ACTIVE">Actives</option>
                <option value="INACTIVE">Inactives</option>
              </select>
            </label>
          </div>
        </div>

        {storesQuery.isLoading ? (
          <p className="px-4 py-14 text-center text-sm text-slate-500">Chargement des boutiques…</p>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <StoreGlyph />
            </div>
            <p className="mt-4 text-base font-medium text-slate-900">Aucune boutique</p>
            <p className="mt-1 text-sm text-slate-500">{emptyHint}</p>
            {canManage && !trimmedSearch && !status ? (
              <Button type="button" className="mt-5" onClick={() => setShowStoreModal(true)}>
                <PlusIcon />
                Nouvelle boutique
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((store) => (
              <StoreRow
                key={store.id}
                store={store}
                canManage={canManage}
                toggling={toggleMutation.isPending}
                onToggle={() => toggleMutation.mutate(store)}
              />
            ))}
          </ul>
        )}

        {storesQuery.data && storesQuery.data.totalPages > 1 ? (
          <div className="border-t border-slate-200 px-4 py-3">
            <Pagination
              page={storesQuery.data.page}
              totalPages={storesQuery.data.totalPages}
              totalItems={storesQuery.data.total}
              onPageChange={setPage}
              itemLabel="boutiques"
            />
          </div>
        ) : null}
      </section>

      <NewStoreModal open={showStoreModal} onClose={() => setShowStoreModal(false)} />
    </div>
  );
}

function StoreRow({
  store,
  canManage,
  toggling,
  onToggle,
}: {
  store: StoreListItem;
  canManage: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  const inactive = store.status === "INACTIVE";
  const meta = [store.city?.trim(), store.address?.trim(), store.phone?.trim()].filter(Boolean).join(" · ");
  const counts = [
    `${store.cashRegisterCount} caisse${store.cashRegisterCount > 1 ? "s" : ""}`,
    `${store.staffCount} agent${store.staffCount > 1 ? "s" : ""}`,
  ].join(" · ");

  const body = (
    <>
      <StoreMonogram code={store.code} inactive={inactive} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] tracking-wide text-slate-500">{store.code}</span>
          <StatusBadge
            label={referentialStatusLabel(store.status)}
            tone={referentialStatusTone(store.status)}
            compact
          />
        </div>
        <p className={`mt-1 truncate text-sm font-semibold tracking-tight ${inactive ? "text-slate-500" : "text-slate-900"}`}>
          {store.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{meta || "Adresse et téléphone à renseigner"}</p>
        <p className="mt-1 text-[11px] text-slate-400">{counts}</p>
      </div>
    </>
  );

  return (
    <li
      className={`group flex flex-col gap-3 px-4 py-3.5 transition sm:flex-row sm:items-center sm:justify-between ${
        inactive ? "bg-slate-50/40" : "hover:bg-slate-50/80"
      }`}
    >
      {canManage ? (
        <Link to={`/admin/stores/${store.id}`} className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">{body}</div>
      )}

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
        {canManage ? (
          <>
            <button
              type="button"
              disabled={toggling}
              onClick={onToggle}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 opacity-100 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              {store.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
            </button>
            <Link
              to={`/admin/stores/${store.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Ouvrir
              <ChevronIcon />
            </Link>
          </>
        ) : null}
      </div>
    </li>
  );
}

function StoreMonogram({ code, inactive }: { code: string; inactive: boolean }) {
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center rounded-xl font-mono text-[11px] font-semibold tracking-wide ${
        inactive
          ? "border border-slate-200 bg-slate-100 text-slate-500"
          : "border border-slate-800/10 bg-slate-900 text-white"
      }`}
      aria-hidden
    >
      {storeMonogram(code)}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number | undefined; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums text-slate-900">{value ?? "—"}</p>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function storeMonogram(code: string): string {
  const cleaned = code.replace(/^BTQ[-_]?/i, "").replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length <= 3) {
    return cleaned.toUpperCase() || code.slice(0, 3).toUpperCase();
  }
  return cleaned.slice(0, 3).toUpperCase();
}

function PlusIcon() {
  return (
    <svg className="mr-1.5 size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 4.5 10.5 8 6 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StoreGlyph() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
