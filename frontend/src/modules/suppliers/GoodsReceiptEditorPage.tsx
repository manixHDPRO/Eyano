import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button, linkButtonClassName } from "../../components/ui/Button";
import { FormField, inputClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import type { GoodsReceiptLinePayload } from "../../lib/api/goods-receipts";
import {
  cancelGoodsReceipt,
  createGoodsReceipt,
  fetchGoodsReceipt,
  setGoodsReceiptItems,
  updateGoodsReceipt,
  validateGoodsReceipt,
} from "../../lib/api/goods-receipts";
import { fetchProducts } from "../../lib/api/products";
import { fetchSupplierOptions } from "../../lib/api/suppliers";
import { fetchWarehouses } from "../../lib/api/warehouses";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { useAuth } from "../auth/AuthProvider";
import { goodsReceiptStatusLabel, goodsReceiptStatusTone } from "./goods-receipt-status";

type DraftLine = GoodsReceiptLinePayload & {
  productReference?: string;
  productName?: string;
};

function toReceiptApiLines(lines: DraftLine[]): GoodsReceiptLinePayload[] {
  return lines.map(({ productId, quantity, unitCost, note }) => ({
    productId,
    quantity,
    unitCost,
    ...(note !== undefined && note !== "" ? { note } : {}),
  }));
}

export function GoodsReceiptEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast, confirm } = useToast();
  const { user } = useAuth();
  const canValidate = user?.permissions.includes("receipts.validate") ?? false;

  const detailQuery = useQuery({
    queryKey: ["goods-receipt", id],
    queryFn: () => fetchGoodsReceipt(id!),
    enabled: !isNew && Boolean(id),
  });

  const suppliersQuery = useQuery({
    queryKey: ["supplier-options"],
    queryFn: () => fetchSupplierOptions(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => fetchWarehouses(),
  });

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["products-picker", productSearch],
    queryFn: () => fetchProducts({ page: 1, pageSize: 8, search: productSearch.trim() || undefined, status: "ACTIVE" }),
    enabled: productSearch.trim().length >= 2,
  });

  useEffect(() => {
    if (detailQuery.data) {
      setSupplierId(detailQuery.data.supplier.id);
      setWarehouseId(detailQuery.data.warehouse.id);
      setNote(detailQuery.data.note ?? "");
      setLines(
        detailQuery.data.items.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: Number(line.unitCost),
          note: line.note ?? undefined,
          productReference: line.productReference,
          productName: line.productName,
        })),
      );
    }
  }, [detailQuery.data]);

  useEffect(() => {
    const warehouses = warehousesQuery.data?.items ?? [];
    if (isNew && warehouses.length === 1 && !warehouseId) {
      setWarehouseId(warehouses[0]!.id);
    }
  }, [warehousesQuery.data, isNew, warehouseId]);

  const isDraft = isNew || detailQuery.data?.status === "DRAFT";

  const { page, setPage, slice: pagedLines, totalPages, totalItems } = useClientPagination(lines, 15);

  const createMutation = useMutation({
    mutationFn: () =>
      createGoodsReceipt({
        supplierId,
        warehouseId,
        note: note.trim() || undefined,
        items: toReceiptApiLines(lines),
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      pushToast({ tone: "success", message: `Réception ${created.reference} créée en brouillon.` });
      navigate(`/admin/goods-receipts/${created.id}`, { replace: true });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Création impossible.") }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      await updateGoodsReceipt(id!, {
        supplierId,
        warehouseId,
        note: note.trim() ? note.trim() : undefined,
      });
      return setGoodsReceiptItems(id!, toReceiptApiLines(lines));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt", id] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      pushToast({ tone: "success", message: "Brouillon enregistré." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Enregistrement impossible.") }),
  });

  const validateMutation = useMutation({
    mutationFn: () => validateGoodsReceipt(id!),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt", id] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      const qty = result.stock[0]?.quantityOnHand;
      pushToast({
        tone: "success",
        message: `Réception validée — stock entrepôt mis à jour${qty !== undefined ? ` (${qty} en main)` : ""}.`,
      });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Validation impossible.") }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelGoodsReceipt(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt", id] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      pushToast({ tone: "success", message: "Réception annulée." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Annulation impossible.") }),
  });

  const loadError = detailQuery.isError ? formatApiErrorMessage(detailQuery.error, "Chargement impossible.") : null;
  const canSubmit = supplierId && warehouseId && lines.length > 0 && lines.every((line) => line.quantity > 0);

  const title = useMemo(() => {
    if (isNew) return "Nouvelle réception";
    return detailQuery.data?.reference ?? "Réception";
  }, [isNew, detailQuery.data?.reference]);

  function addProduct(productId: string, reference: string, name: string, purchasePrice: number) {
    if (lines.some((line) => line.productId === productId)) {
      pushToast({ tone: "info", message: "Ce produit est déjà sur la réception." });
      return;
    }
    setLines((current) => [
      ...current,
      { productId, quantity: 1, unitCost: purchasePrice, productReference: reference, productName: name },
    ]);
    setProductSearch("");
  }

  function updateLine(productId: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  async function handleValidate() {
    const accepted = await confirm({
      title: "Valider la réception",
      message:
        "Cette action est définitive : création des mouvements GOODS_RECEIPT et incrément unique des soldes entrepôt. Continuer ?",
      confirmLabel: "Valider",
      tone: "danger",
    });
    if (!accepted) return;
    if (isDraft && !isNew) {
      await saveDraftMutation.mutateAsync();
    }
    void validateMutation.mutateAsync();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stocks"
        title={title}
        description="Saisissez le coût d’achat de chaque ligne : il est conservé sur le mouvement, sans modifier le tarif catalogue."
        actions={
          <Link to="/admin/goods-receipts" className={linkButtonClassName}>
            Retour à la liste
          </Link>
        }
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {!isNew && detailQuery.data ? (
        <StatusBadge
          label={goodsReceiptStatusLabel(detailQuery.data.status)}
          tone={goodsReceiptStatusTone(detailQuery.data.status)}
        />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <FormField label="Fournisseur" htmlFor="receipt-supplier">
            <select
              id="receipt-supplier"
              value={supplierId}
              disabled={!isDraft}
              onChange={(e) => setSupplierId(e.target.value)}
              className={inputClassName}
              required
            >
              <option value="">— Choisir —</option>
              {(suppliersQuery.data?.items ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Entrepôt" htmlFor="receipt-warehouse">
            <select
              id="receipt-warehouse"
              value={warehouseId}
              disabled={!isDraft}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={inputClassName}
              required
            >
              <option value="">— Choisir —</option>
              {(warehousesQuery.data?.items ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} — {warehouse.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Note interne" htmlFor="receipt-note">
            <textarea
              id="receipt-note"
              value={note}
              disabled={!isDraft}
              onChange={(e) => setNote(e.target.value)}
              className={inputClassName}
              rows={3}
            />
          </FormField>
        </div>

        <div className="lg:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          {isDraft ? (
            <div>
              <FormField label="Ajouter un produit" htmlFor="receipt-product-search" hint="Recherchez par référence ou nom (min. 2 caractères)">
                <input
                  id="receipt-product-search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className={inputClassName}
                  placeholder="Référence, nom…"
                />
              </FormField>
              {productsQuery.data?.items.length ? (
                <ul className="mt-2 rounded-lg border border-slate-200 bg-white text-sm">
                  {productsQuery.data.items.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100"
                        onClick={() => addProduct(product.id, product.reference, product.name, product.purchasePrice)}
                      >
                        <span>
                          <span className="font-mono text-slate-400">{product.reference}</span> — {product.name}
                        </span>
                        <span className="text-slate-500">{product.purchasePrice} USD</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Produit</th>
                <th className="pb-2 w-24">Qté</th>
                <th className="pb-2 w-28">Coût USD</th>
                {isDraft ? <th className="pb-2 w-12" /> : null}
              </tr>
            </thead>
            <tbody>
              {pagedLines.map((line) => (
                <tr key={line.productId} className="border-t border-slate-100">
                  <td className="py-2">
                    <span className="font-mono text-xs text-slate-400">{line.productReference}</span>
                    <div>{line.productName ?? line.productId}</div>
                  </td>
                  <td className="py-2">
                    {isDraft ? (
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.productId, { quantity: Number(e.target.value) })}
                        className={inputClassName}
                      />
                    ) : (
                      line.quantity
                    )}
                  </td>
                  <td className="py-2">
                    {isDraft ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.productId, { unitCost: Number(e.target.value) })}
                        className={inputClassName}
                      />
                    ) : (
                      line.unitCost
                    )}
                  </td>
                  {isDraft ? (
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => removeLine(line.productId)}
                      >
                        Retirer
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length > 0 ? (
            <div className="mt-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={setPage}
                itemLabel="lignes"
              />
            </div>
          ) : null}
          {lines.length === 0 ? <p className="text-sm text-slate-500">Ajoutez au moins une ligne produit.</p> : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {isNew ? (
          <Button type="button" disabled={!canSubmit || createMutation.isPending} onClick={() => void createMutation.mutateAsync()}>
            Créer le brouillon
          </Button>
        ) : null}
        {!isNew && isDraft ? (
          <>
            <Button type="button" disabled={!canSubmit || saveDraftMutation.isPending} onClick={() => void saveDraftMutation.mutateAsync()}>
              Enregistrer le brouillon
            </Button>
            {canValidate ? (
              <Button
                type="button"
                variant="primary"
                disabled={!canSubmit || validateMutation.isPending}
                onClick={() => void handleValidate()}
              >
                Valider la réception
              </Button>
            ) : (
              <Alert tone="info">La permission receipts.validate est requise pour valider.</Alert>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={cancelMutation.isPending}
              onClick={() => void cancelMutation.mutateAsync()}
            >
              Annuler le brouillon
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
