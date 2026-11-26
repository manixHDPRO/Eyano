import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "../../components/ui/Alert";
import { modalFieldClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import {
  fetchCentralWarehouseDashboard,
  postCentralWarehouseAdjust,
  postCentralWarehouseReceive,
} from "../../lib/api/central-warehouse";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchSupplierOptions } from "../../lib/api/suppliers";
import { formatUsd } from "../catalog/money";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { usePermission } from "../auth/usePermission";

export function CentralWarehousePage() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const canValidateReceipts = usePermission("receipts.validate");
  const canManageSuppliers = usePermission("suppliers.manage");
  const canReceive = canValidateReceipts || canManageSuppliers;
  const canAdjust = usePermission("stock.adjust");

  const dashboardQuery = useQuery({
    queryKey: ["central-warehouse"],
    queryFn: fetchCentralWarehouseDashboard,
  });

  const suppliersQuery = useQuery({
    queryKey: ["supplier-options"],
    queryFn: fetchSupplierOptions,
  });

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ productId: "", supplierId: "", quantity: "50", notes: "" });
  const [adjustForm, setAdjustForm] = useState({ productId: "", newQuantity: "0", notes: "" });

  const stockRows = dashboardQuery.data?.stockRows ?? [];
  const {
    page: stockPage,
    setPage: setStockPage,
    slice: pagedStockRows,
    totalPages: stockTotalPages,
    totalItems: stockTotalItems,
  } = useClientPagination(stockRows, 20);
  const suppliers = suppliersQuery.data?.items ?? [];

  useEffect(() => {
    if (stockRows[0] && !receiveForm.productId) {
      setReceiveForm((prev) => ({ ...prev, productId: stockRows[0]!.productId }));
      setAdjustForm((prev) => ({
        ...prev,
        productId: stockRows[0]!.productId,
        newQuantity: String(stockRows[0]!.quantity),
      }));
    }
    if (suppliers[0] && !receiveForm.supplierId) {
      setReceiveForm((prev) => ({ ...prev, supplierId: suppliers[0]!.id }));
    }
  }, [stockRows, suppliers, receiveForm.productId, receiveForm.supplierId]);

  const quantityByProduct = useMemo(() => new Map(stockRows.map((row) => [row.productId, row.quantity])), [stockRows]);

  const receiveMutation = useMutation({
    mutationFn: postCentralWarehouseReceive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["central-warehouse"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setShowReceiveModal(false);
      pushToast({ tone: "success", message: "Réception fournisseur enregistrée dans le stock entrepôt." });
    },
    onError: (error) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Réception impossible.") });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: postCentralWarehouseAdjust,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["central-warehouse"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setShowAdjustModal(false);
      pushToast({ tone: "success", message: "Ajustement de stock entrepôt enregistré." });
    },
    onError: (error) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Ajustement impossible.") });
    },
  });

  const errorMessage = dashboardQuery.isError
    ? formatApiErrorMessage(dashboardQuery.error, "Chargement de l’entrepôt central impossible.")
    : null;

  function onReceiveSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canReceive) {
      return;
    }
    receiveMutation.mutate({
      productId: receiveForm.productId,
      supplierId: receiveForm.supplierId,
      quantity: Number(receiveForm.quantity),
      notes: receiveForm.notes.trim() || undefined,
    });
  }

  function onAdjustSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canAdjust) {
      return;
    }
    adjustMutation.mutate({
      productId: adjustForm.productId,
      newQuantity: Number(adjustForm.newQuantity),
      notes: adjustForm.notes.trim(),
    });
  }

  const data = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stocks"
        title="Entrepôt central"
        description="Approvisionnement central, valorisation et état du stock à l’entrepôt."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canAdjust ? (
              <button
                type="button"
                onClick={() => setShowAdjustModal(true)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Ajustement autorisé
              </button>
            ) : null}
            {canReceive ? (
              <button
                type="button"
                onClick={() => setShowReceiveModal(true)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Réception fournisseur
              </button>
            ) : null}
          </div>
        }
      />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {dashboardQuery.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Stock total entrepôt</p>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                {data.totalUnits.toLocaleString("fr-FR")} unités
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Valorisation au prix d’achat</p>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                {formatUsd(data.totalValuationUsd)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Références sous seuil</p>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
                {data.lowStockCount} produit(s)
              </p>
            </article>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-900">
              État du stock — {data.warehouse.name}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Référence</th>
                    <th className="px-4 py-2.5 font-medium">Désignation</th>
                    <th className="px-4 py-2.5 text-right font-medium">Coût unitaire</th>
                    <th className="px-4 py-2.5 text-right font-medium">Quantité</th>
                    <th className="px-4 py-2.5 text-right font-medium">Valorisation</th>
                    <th className="px-4 py-2.5 text-right font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedStockRows.map((row) => (
                    <tr key={row.productId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-slate-600">{row.reference}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatUsd(row.purchasePriceUsd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatUsd(row.valuationUsd)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {row.isStockout ? (
                          <span className="font-semibold text-red-700">Rupture</span>
                        ) : row.isLowStock ? (
                          <span className="font-medium text-amber-700">Alerte (≤ {row.alertThreshold})</span>
                        ) : (
                          <span className="text-emerald-700">Nominal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stockRows.length > 0 ? (
              <div className="border-t border-slate-200 px-4 py-3">
                <Pagination
                  page={stockPage}
                  totalPages={stockTotalPages}
                  totalItems={stockTotalItems}
                  onPageChange={setStockPage}
                  itemLabel="références"
                />
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {showReceiveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Réception marchandise entrepôt</h3>
            <form onSubmit={onReceiveSubmit} className="mt-4 space-y-2.5 text-xs">
              <label className="block">
                <span className="mb-1 block font-medium text-slate-700">Produit *</span>
                <select
                  required
                  value={receiveForm.productId}
                  onChange={(event) => setReceiveForm({ ...receiveForm, productId: event.target.value })}
                  className={modalFieldClassName}
                >
                  {stockRows.map((row) => (
                    <option key={row.productId} value={row.productId}>
                      {row.reference} — {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-slate-700">Fournisseur *</span>
                <select
                  required
                  value={receiveForm.supplierId}
                  onChange={(event) => setReceiveForm({ ...receiveForm, supplierId: event.target.value })}
                  className={modalFieldClassName}
                >
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-slate-700">Quantité reçue *</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={receiveForm.quantity}
                  onChange={(event) => setReceiveForm({ ...receiveForm, quantity: event.target.value })}
                  className={`${modalFieldClassName} font-mono tabular-nums`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-slate-700">Bon de livraison / Notes</span>
                <input
                  type="text"
                  value={receiveForm.notes}
                  onChange={(event) => setReceiveForm({ ...receiveForm, notes: event.target.value })}
                  className={modalFieldClassName}
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={receiveMutation.isPending}
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {receiveMutation.isPending ? "…" : "Valider l’entrée"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAdjustModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Ajustement stock entrepôt</h3>
            <form onSubmit={onAdjustSubmit} className="mt-4 space-y-2.5 text-xs">
              <label className="block">
                <span className="mb-1 block font-medium text-slate-700">Produit *</span>
                <select
                  required
                  value={adjustForm.productId}
                  onChange={(event) => {
                    const productId = event.target.value;
                    setAdjustForm({
                      ...adjustForm,
                      productId,
                      newQuantity: String(quantityByProduct.get(productId) ?? 0),
                    });
                  }}
                  className={modalFieldClassName}
                >
                  {stockRows.map((row) => (
                    <option key={row.productId} value={row.productId}>
                      {row.reference} — {row.name} (actuel : {row.quantity})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-slate-700">Nouvelle quantité réelle *</span>
                <input
                  type="number"
                  min={0}
                  required
                  value={adjustForm.newQuantity}
                  onChange={(event) => setAdjustForm({ ...adjustForm, newQuantity: event.target.value })}
                  className={`${modalFieldClassName} font-mono tabular-nums`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-slate-700">Motif obligatoire *</span>
                <input
                  type="text"
                  required
                  value={adjustForm.notes}
                  onChange={(event) => setAdjustForm({ ...adjustForm, notes: event.target.value })}
                  placeholder="Justification administrative"
                  className={modalFieldClassName}
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={adjustMutation.isPending}
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {adjustMutation.isPending ? "…" : "Enregistrer l’ajustement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}