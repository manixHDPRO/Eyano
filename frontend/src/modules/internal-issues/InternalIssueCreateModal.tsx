import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  createInternalIssue,
  fetchInternalIssueCatalog,
  fetchInternalIssueLocations,
  submitInternalIssue,
} from "../../lib/api/internal-issues";
import type { InternalIssueReason, InternalIssueScopeType } from "../../lib/api/types";
import { locationKeyFromOption } from "./internal-issue-status";

const REASONS: Array<{ value: InternalIssueReason; label: string }> = [
  { value: "CLEANING", label: "Nettoyage de tissages" },
  { value: "MAINTENANCE", label: "Entretien" },
  { value: "INTERNAL_USE", label: "Utilisation interne" },
  { value: "DAMAGED", label: "Produits détériorés" },
  { value: "OTHER", label: "Autres" },
];

type InternalIssueCreateModalProps = {
  open: boolean;
  onClose: () => void;
};

export function InternalIssueCreateModal({ open, onClose }: InternalIssueCreateModalProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const locationsQuery = useQuery({
    queryKey: ["internal-issue-locations"],
    queryFn: fetchInternalIssueLocations,
    enabled: open,
  });

  const [locationKey, setLocationKey] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reasonCode, setReasonCode] = useState<InternalIssueReason>("CLEANING");
  const [reasonDetail, setReasonDetail] = useState("");

  const selectedLocation = useMemo(() => {
    const items = locationsQuery.data?.items ?? [];
    return items.find((row) => locationKeyFromOption(row) === locationKey);
  }, [locationsQuery.data, locationKey]);

  const scopeType: InternalIssueScopeType | undefined = selectedLocation?.scopeType;
  const warehouseId = selectedLocation?.warehouse?.id;
  const storeId = selectedLocation?.store?.id;

  const catalogQuery = useQuery({
    queryKey: ["internal-issue-catalog-modal", scopeType, warehouseId, storeId],
    queryFn: () =>
      fetchInternalIssueCatalog({
        scopeType: scopeType!,
        warehouseId,
        storeId,
        pageSize: 100,
      }),
    enabled: open && Boolean(scopeType && (warehouseId || storeId)),
  });

  useEffect(() => {
    const items = locationsQuery.data?.items ?? [];
    if (!locationKey && items.length > 0) {
      const store = items.find((row) => row.scopeType === "STORE") ?? items[0];
      setLocationKey(locationKeyFromOption(store));
    }
  }, [locationsQuery.data, locationKey]);

  useEffect(() => {
    const products = catalogQuery.data?.items ?? [];
    if (products.length === 0) {
      setProductId("");
      return;
    }
    const stillValid = products.some((row) => row.productId === productId);
    if (!stillValid) {
      setProductId(products[0].productId);
    }
  }, [catalogQuery.data, productId, locationKey]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocation || !productId) {
        throw new Error("Tous les champs de la sortie interne sont requis.");
      }
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        throw new Error("Quantité invalide.");
      }
      const payload =
        selectedLocation.scopeType === "WAREHOUSE"
          ? {
              scopeType: "WAREHOUSE" as const,
              warehouseId: selectedLocation.warehouse!.id,
              productId,
              quantity: qty,
              reasonCode,
              reasonText: reasonDetail.trim() || undefined,
            }
          : {
              scopeType: "STORE" as const,
              storeId: selectedLocation.store!.id,
              productId,
              quantity: qty,
              reasonCode,
              reasonText: reasonDetail.trim() || undefined,
            };
      const created = await createInternalIssue(payload);
      return submitInternalIssue(created.id);
    },
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["internal-issues"] });
      await queryClient.invalidateQueries({ queryKey: ["internal-issues-summary"] });
      pushToast({
        tone: "success",
        message: `Demande ${detail.reference} transmise à la validation centrale.`,
      });
      onClose();
    },
    onError: (error) =>
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Création impossible.") }),
  });

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitMutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Demande de sortie interne</h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium text-slate-700" htmlFor="issue-location">
              Établissement *
            </label>
            <select
              id="issue-location"
              value={locationKey}
              onChange={(event) => {
                setLocationKey(event.target.value);
                setProductId("");
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {(locationsQuery.data?.items ?? []).map((option) => (
                <option key={locationKeyFromOption(option)} value={locationKeyFromOption(option)}>
                  {option.scopeType === "WAREHOUSE"
                    ? `Entrepôt central — ${option.warehouse?.name}`
                    : option.store?.name}
                </option>
              ))}
            </select>
          </div>
          {catalogQuery.isError ? (
            <p className="text-xs text-red-700">
              {formatApiErrorMessage(catalogQuery.error, "Impossible de charger les produits.")}
            </p>
          ) : null}
          <div>
            <label className="mb-1 block font-medium text-slate-700" htmlFor="issue-product">
              Produit *
            </label>
            <select
              id="issue-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
              disabled={catalogQuery.isLoading || (catalogQuery.data?.items.length ?? 0) === 0}
            >
              {catalogQuery.isLoading ? (
                <option value="">Chargement des produits…</option>
              ) : (catalogQuery.data?.items.length ?? 0) === 0 ? (
                <option value="">Aucun produit avec stock sur ce site</option>
              ) : null}
              {(catalogQuery.data?.items ?? []).map((product) => (
                <option key={product.productId} value={product.productId}>
                  {product.reference} — {product.name} (dispo. {product.quantityAvailable})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700" htmlFor="issue-qty">
              Quantité *
            </label>
            <input
              id="issue-qty"
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700" htmlFor="issue-reason">
              Motif *
            </label>
            <select
              id="issue-reason"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value as InternalIssueReason)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700" htmlFor="issue-detail">
              Précisions
            </label>
            <input
              id="issue-detail"
              type="text"
              value={reasonDetail}
              onChange={(event) => setReasonDetail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Transmettre
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}