import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { createTransfer, fetchTransferCatalog, fetchTransferDestinations } from "../../lib/api/transfers";
import { fetchWarehouses } from "../../lib/api/warehouses";
import { formatApiErrorMessage } from "../../lib/api/errors";
const selectClass =
  "native-select-light w-full rounded-lg border px-3 py-2 text-xs shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300";
const lineSelectClass = "native-select-light min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-xs";
const lineQtyClass =
  "w-20 rounded-lg border border-slate-300 bg-white px-2 py-2 font-mono text-xs tabular-nums text-slate-900";

type TransferCreateModalProps = {
  onClose: () => void;
  onCreated: () => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onError: (message: string) => void;
};

type DraftLine = { productId: string; quantity: number };

function formatStoreLabel(store: { name: string; code: string; city: string | null }): string {
  const locality = store.city?.trim();
  return locality ? `${store.name} — ${locality} (${store.code})` : `${store.name} (${store.code})`;
}

export function TransferCreateModal({ onClose, onCreated, busy, setBusy, onError }: TransferCreateModalProps) {
  const destinationsQuery = useQuery({ queryKey: ["transfer-destinations"], queryFn: fetchTransferDestinations });
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });

  const warehouses = warehousesQuery.data?.items ?? [];
  const stores = destinationsQuery.data?.items ?? [];

  const [warehouseId, setWarehouseId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  useEffect(() => {
    if (warehouses.length >= 1 && !warehouseId) {
      setWarehouseId(warehouses[0]!.id);
    }
  }, [warehouses, warehouseId]);

  useEffect(() => {
    if (stores.length >= 1 && !storeId) {
      setStoreId(stores[0]!.id);
    }
  }, [stores, storeId]);

  const catalogQuery = useQuery({
    queryKey: ["transfer-catalog-modal", storeId, warehouseId],
    queryFn: () => fetchTransferCatalog({ storeId, warehouseId }),
    enabled: Boolean(storeId && warehouseId),
    placeholderData: (previous) => previous,
  });

  const catalog = catalogQuery.data?.items ?? [];

  useEffect(() => {
    if (!storeId || !warehouseId || catalogQuery.isFetching || !catalogQuery.isSuccess) {
      return;
    }
    const items = catalogQuery.data?.items ?? [];
    if (items.length === 0) {
      setLines([]);
      return;
    }
    setLines((current) => {
      if (current.length === 0) {
        const first = items[0]!;
        return [
          {
            productId: first.productId,
            quantity: Math.min(10, Math.max(1, first.quantityAvailable)) || 1,
          },
        ];
      }
      const catalogIds = new Set(items.map((row) => row.productId));
      const allValid = current.every((line) => catalogIds.has(line.productId));
      if (allValid) {
        return current;
      }
      const first = items[0]!;
      return [
        {
          productId: first.productId,
          quantity: Math.min(10, Math.max(1, first.quantityAvailable)) || 1,
        },
      ];
    });
  }, [storeId, warehouseId, catalogQuery.isSuccess, catalogQuery.isFetching, catalogQuery.data]);

  function addLine() {
    const product = catalog.find((row) => !lines.some((line) => line.productId === row.productId)) ?? catalog[0];
    if (!product) {
      onError("Aucun article autorisé pour cette boutique.");
      return;
    }
    setLines((current) => [
      ...current,
      {
        productId: product.productId,
        quantity: Math.min(10, Math.max(1, product.quantityAvailable)) || 1,
      },
    ]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!warehouseId || !storeId || lines.length === 0) {
      onError("Boutique, entrepôt et au moins un article sont obligatoires.");
      return;
    }
    for (const line of lines) {
      const product = catalog.find((row) => row.productId === line.productId);
      if (product && line.quantity > product.quantityAvailable) {
        onError(`Stock entrepôt insuffisant pour « ${product.name} » (dispo : ${product.quantityAvailable}).`);
        return;
      }
    }
    setBusy(true);
    onError("");
    try {
      await createTransfer({
        warehouseId,
        storeId,
        note: note.trim() || undefined,
        submitImmediately: true,
        items: lines.map((line) => ({
          productId: line.productId,
          quantityRequested: line.quantity,
        })),
      });
      onCreated();
      onClose();
    } catch (error) {
      onError(formatApiErrorMessage(error, "Création impossible."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Nouveau transfert Entrepôt → Boutique</h3>

        <form className="mt-4 space-y-3 text-xs" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label className="mb-1 block font-medium text-slate-700" htmlFor="transfer-create-store">
              Boutique destinataire *
            </label>
            <select
              id="transfer-create-store"
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                setLines([]);
              }}
              className={selectClass}
              required
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {formatStoreLabel(store)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700">Articles à transférer</span>
              <button
                type="button"
                onClick={() => addLine()}
                disabled={!storeId || catalog.length === 0}
                className="font-semibold text-slate-900 underline underline-offset-2 disabled:opacity-40"
              >
                + Ajouter ligne
              </button>
            </div>
            {catalogQuery.data?.total !== undefined && catalog.length > 0 ? (
              <p className="text-slate-500">
                {catalogQuery.data.total} article(s) avec stock entrepôt disponible (&gt; 0) pour cette boutique.
              </p>
            ) : null}
            {lines.map((line, index) => (
              <div key={`${line.productId}-${index}`} className="flex items-center gap-2">
                <select
                  value={line.productId}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, i) => (i === index ? { ...row, productId: event.target.value } : row)),
                    )
                  }
                  className={lineSelectClass}
                  disabled={!catalog.length}
                >
                  {catalog.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.name} (Dispo entrepôt : {product.quantityAvailable})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, i) => (i === index ? { ...row, quantity: Number(event.target.value) } : row)),
                    )
                  }
                  className={lineQtyClass}
                  aria-label="Quantité"
                />
              </div>
            ))}
            {catalogQuery.isFetching && storeId ? (
              <p className="text-slate-500">Chargement des articles autorisés…</p>
            ) : null}
            {catalogQuery.isError && storeId ? (
              <p className="text-red-700">
                {formatApiErrorMessage(catalogQuery.error, "Impossible de charger le catalogue pour cette boutique.")}
              </p>
            ) : null}
            {!catalogQuery.isFetching && !catalogQuery.isError && !catalog.length && storeId ? (
              <p className="text-slate-500">
                Aucun article autorisé avec quantité disponible à l’entrepôt pour cette boutique (stock &gt; 0 requis).
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-700" htmlFor="transfer-create-notes">
              Notes
            </label>
            <input
              id="transfer-create-notes"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || lines.length === 0 || !storeId}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Création…" : "Créer et soumettre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}