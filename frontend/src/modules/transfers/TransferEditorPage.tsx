import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button, ghostLinkClassName } from "../../components/ui/Button";
import { FormField, inputClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  cancelTransfer,
  createTransfer,
  fetchTransfer,
  fetchTransferCatalog,
  fetchTransferDestinations,
  prepareTransfer,
  receiveTransfer,
  setTransferItems,
  shipTransfer,
  submitTransfer,
  updateTransfer,
  validateTransfer,
} from "../../lib/api/transfers";
import { fetchWarehouses } from "../../lib/api/warehouses";
import type { TransferCatalogItem, TransferDetail, TransferListItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { TransferReceiveModal } from "./TransferReceiveModal";
import { TransferShipPrint } from "./TransferShipPrint";
import {
  buildTransferShipPrintPayload,
  canPrintTransferShipFiche,
  type TransferShipPrintPayload,
} from "./transfer-ship-print-data";
import { personName, transferStatusLabel, transferStatusTone } from "./transfer-status";

type DraftLine = {
  productId: string;
  productReference: string;
  productName: string;
  quantityRequested: number;
  quantityAvailable?: number;
};

export function TransferEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast, confirm } = useToast();
  const { user } = useAuth();

  const canCreate = hasPermission(user, "transfers.create");
  const canValidate = hasPermission(user, "transfers.validate");
  const canShip = hasPermission(user, "transfers.prepare_ship");
  const canReceive = hasPermission(user, "transfers.receive");
  const cashierReceiveOnly = canReceive && !canCreate && !canValidate && !canShip;

  const detailQuery = useQuery({
    queryKey: ["transfer", id],
    queryFn: () => fetchTransfer(id!),
    enabled: !isNew && Boolean(id),
  });

  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const destinationsQuery = useQuery({ queryKey: ["transfer-destinations"], queryFn: fetchTransferDestinations });

  const [warehouseId, setWarehouseId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [receivedQty, setReceivedQty] = useState<Record<string, number>>({});
  const [cancelReason, setCancelReason] = useState("");
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [shipPrintPayload, setShipPrintPayload] = useState<TransferShipPrintPayload | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["transfer-catalog", storeId, warehouseId, productSearch],
    queryFn: () =>
      fetchTransferCatalog({
        storeId,
        warehouseId,
        search: productSearch.trim() || undefined,
      }),
    enabled: Boolean(storeId && warehouseId && productSearch.trim().length >= 2),
  });

  useEffect(() => {
    const warehouses = warehousesQuery.data?.items ?? [];
    if (isNew && warehouses.length === 1 && !warehouseId) {
      setWarehouseId(warehouses[0]!.id);
    }
  }, [warehousesQuery.data, isNew, warehouseId]);

  const lastHydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) return;
    const hydrationKey = `${detail.id}:${detail.updatedAt}`;
    if (detail.status === "DRAFT" && lastHydratedKeyRef.current === hydrationKey) {
      return;
    }
    lastHydratedKeyRef.current = hydrationKey;
    setWarehouseId(detail.warehouse.id);
    setStoreId(detail.store.id);
    setNote(detail.note ?? "");
    setLines(
      detail.items.map((line) => ({
        productId: line.productId,
        productReference: line.productReference,
        productName: line.productName,
        quantityRequested: line.quantityRequested,
      })),
    );
    setReceivedQty(
      Object.fromEntries(detail.items.map((line) => [line.productId, line.quantityShipped])),
    );
  }, [detailQuery.data]);

  const status = detailQuery.data?.status ?? "DRAFT";
  const isDraft = isNew || status === "DRAFT";
  const title = isNew ? "Nouveau transfert" : (detailQuery.data?.reference ?? "Transfert");
  const transferItems = detailQuery.data?.items ?? [];

  const {
    page: draftLinesPage,
    setPage: setDraftLinesPage,
    slice: pagedDraftLines,
    totalPages: draftLinesTotalPages,
    totalItems: draftLinesTotalItems,
  } = useClientPagination(lines, 15);

  const {
    page: transferItemsPage,
    setPage: setTransferItemsPage,
    slice: pagedTransferItems,
    totalPages: transferItemsTotalPages,
    totalItems: transferItemsTotalItems,
  } = useClientPagination(transferItems, 15);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["transfer", id] });
    await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    await queryClient.invalidateQueries({ queryKey: ["transfers-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-summary"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createTransfer({
        warehouseId,
        storeId,
        note: note.trim() || undefined,
        items: lines.map(({ productId, quantityRequested }) => ({ productId, quantityRequested })),
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
      pushToast({ tone: "success", message: `Transfert ${created.reference} créé.` });
      navigate(`/admin/transfers/${created.id}`, { replace: true });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Création impossible.") }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateTransfer(id!, { warehouseId, storeId, note: note.trim() || undefined });
      return setTransferItems(
        id!,
        lines.map(({ productId, quantityRequested }) => ({ productId, quantityRequested })),
      );
    },
    onSuccess: async () => {
      await invalidate();
      pushToast({ tone: "success", message: "Brouillon enregistré." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Enregistrement impossible.") }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await updateTransfer(id!, { warehouseId, storeId, note: note.trim() || undefined });
      await setTransferItems(
        id!,
        lines.map(({ productId, quantityRequested }) => ({ productId, quantityRequested })),
      );
      return submitTransfer(id!);
    },
    onSuccess: async () => {
      await invalidate();
      pushToast({ tone: "success", message: "Demande soumise — en attente de validation." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Soumission impossible.") }),
  });

  const validateMutation = useMutation({
    mutationFn: () => validateTransfer(id!),
    onSuccess: async () => {
      await invalidate();
      pushToast({ tone: "success", message: "Transfert validé — quantités réservées à l’entrepôt." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Validation impossible.") }),
  });

  const prepareMutation = useMutation({
    mutationFn: () => prepareTransfer(id!),
    onSuccess: async () => {
      await invalidate();
      pushToast({ tone: "success", message: "Préparation lancée." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Préparation impossible.") }),
  });

  const shipMutation = useMutation({
    mutationFn: () => shipTransfer(id!),
    onSuccess: async (detail: TransferDetail) => {
      await invalidate();
      setShipPrintPayload(buildTransferShipPrintPayload(detail));
      pushToast({
        tone: "success",
        message: "Expédié — imprimez la fiche de transfert (caissière, témoin, expéditeur).",
      });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Expédition impossible.") }),
  });

  const receiveMutation = useMutation({
    mutationFn: (items: Array<{ transferItemId: string; quantityReceived: number }>) =>
      receiveTransfer(id!, { complete: true, items }),
    onSuccess: async (result) => {
      setShowReceiveModal(false);
      await invalidate();
      pushToast({
        tone: result.hasVariance ? "info" : "success",
        message: result.hasVariance
          ? "Réception enregistrée avec écart — le manquant reste sorti de l’entrepôt."
          : "Réception conforme, stock boutique mis à jour.",
      });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Réception impossible.") }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTransfer(id!, cancelReason.trim() || undefined),
    onSuccess: async () => {
      await invalidate();
      pushToast({ tone: "success", message: "Transfert annulé." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Annulation impossible.") }),
  });

  const canSubmitDraft = warehouseId && storeId && lines.length > 0 && lines.every((line) => line.quantityRequested > 0);
  const loadError = detailQuery.isError ? formatApiErrorMessage(detailQuery.error, "Chargement impossible.") : null;

  function addProduct(product: TransferCatalogItem) {
    if (lines.some((line) => line.productId === product.productId)) {
      pushToast({ tone: "info", message: "Ce produit est déjà sur le transfert." });
      return;
    }
    if (product.quantityAvailable <= 0) {
      pushToast({ tone: "info", message: "Aucun disponible à l’entrepôt pour cet article." });
      return;
    }
    setLines((current) => [
      ...current,
      {
        productId: product.productId,
        productReference: product.reference,
        productName: product.name,
        quantityRequested: Math.min(1, product.quantityAvailable) || 1,
        quantityAvailable: product.quantityAvailable,
      },
    ]);
    setProductSearch("");
  }

  async function handleValidate() {
    const accepted = await confirm({
      title: "Valider le transfert",
      message: "La quantité demandée sera réservée à l’entrepôt (le physique ne bouge pas encore). Continuer ?",
      confirmLabel: "Réserver et valider",
    });
    if (!accepted) return;
    void validateMutation.mutateAsync();
  }

  async function handleShip() {
    const accepted = await confirm({
      title: "Expédier",
      message:
        "Sortie physique de l’entrepôt et libération de la réservation. La fiche de transfert (3 signatures) sera proposée à l’impression. Cette étape n’est pas annulable.",
      confirmLabel: "Expédier",
      tone: "danger",
    });
    if (!accepted) return;
    void shipMutation.mutateAsync();
  }

  function handlePrintShipFiche() {
    const detail = detailQuery.data;
    if (!detail) {
      return;
    }
    setShipPrintPayload(buildTransferShipPrintPayload(detail));
  }

  async function handleCancel() {
    const needsReason = status === "VALIDATED" || status === "PREPARING";
    if (needsReason && cancelReason.trim().length < 3) {
      pushToast({ tone: "info", message: "Indiquez un motif d’annulation (réservation à libérer)." });
      return;
    }
    const accepted = await confirm({
      title: "Annuler le transfert",
      message: needsReason
        ? "La réservation entrepôt sera libérée. Continuer ?"
        : "Le document passera au statut annulé.",
      confirmLabel: "Annuler le document",
      tone: "danger",
    });
    if (!accepted) return;
    void cancelMutation.mutateAsync();
  }

  const receivePreview = useMemo(() => {
    const items = detailQuery.data?.items ?? [];
    return items.map((line) => {
      const received = Number(receivedQty[line.productId] ?? 0);
      return { ...line, received, variance: received - line.quantityShipped };
    });
  }, [detailQuery.data, receivedQty]);

  const receiveModalTransfer = useMemo((): TransferListItem | null => {
    const detail = detailQuery.data;
    if (!detail) return null;
    return {
      id: detail.id,
      reference: detail.reference,
      status: detail.status,
      warehouse: detail.warehouse,
      store: detail.store,
      lineCount: detail.lineCount,
      totalRequested: detail.totalRequested,
      totalShipped: detail.totalShipped,
      totalReceived: detail.totalReceived,
      hasVariance: detail.hasVariance,
      createdAt: detail.createdAt,
      validatedAt: detail.validatedAt,
      shippedAt: detail.shippedAt,
      receivedAt: detail.receivedAt,
      items: detail.items.map((line) => ({
        id: line.id,
        productId: line.productId,
        productReference: line.productReference,
        productName: line.productName,
        quantityRequested: line.quantityRequested,
        quantityShipped: line.quantityShipped,
        quantityReceived: line.quantityReceived,
        discrepancy: line.quantityShipped - line.quantityReceived,
      })),
    };
  }, [detailQuery.data]);

  const pageDescription = cashierReceiveOnly
    ? "Vérifiez le bordereau expédié vers votre boutique puis accusez réception des quantités physiquement reçues."
    : "Cycle officiel d’approvisionnement boutique. Seuls les produits déjà autorisés dans la boutique destinataire peuvent voyager.";

  const canAccuseReception = canReceive && status === "SHIPPED" && Boolean(detailQuery.data);
  const canPrintShipFiche =
    !isNew && Boolean(detailQuery.data) && canPrintTransferShipFiche(status) && (canShip || canValidate);

  return (
    <div className="space-y-6">
      {shipPrintPayload ? (
        <TransferShipPrint payload={shipPrintPayload} onPrinted={() => setShipPrintPayload(null)} />
      ) : null}
      <PageHeader
        eyebrow="Stocks"
        title={title}
        description={pageDescription}
        actions={
          <Link to="/admin/transfers" className={ghostLinkClassName}>
            Retour à la liste
          </Link>
        }
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {!isNew && detailQuery.data ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={transferStatusLabel(detailQuery.data.status)} tone={transferStatusTone(detailQuery.data.status)} />
          {detailQuery.data.hasVariance ? <StatusBadge label="Écart signalé" tone="danger" /> : null}
          <p className="text-sm text-slate-400">
            Créé par {personName(detailQuery.data.createdBy)}
            {detailQuery.data.validatedBy ? ` · validé par ${personName(detailQuery.data.validatedBy)}` : ""}
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trajet</p>
          <FormField label="Entrepôt source" htmlFor="transfer-warehouse">
            <select
              id="transfer-warehouse"
              value={warehouseId}
              disabled={!isDraft}
              onChange={(event) => setWarehouseId(event.target.value)}
              className={inputClassName}
            >
              <option value="">— Choisir —</option>
              {(warehousesQuery.data?.items ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} — {warehouse.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex justify-center text-slate-500" aria-hidden>
            ↓
          </div>
          <FormField
            label="Boutique destinataire"
            htmlFor="transfer-store"
            hint="Produits autorisés dans la boutique et en stock à l’entrepôt (disponible > 0)."
          >
            <select
              id="transfer-store"
              value={storeId}
              disabled={!isDraft}
              onChange={(event) => {
                setStoreId(event.target.value);
                setLines([]);
              }}
              className={inputClassName}
            >
              <option value="">— Choisir —</option>
              {(destinationsQuery.data?.items ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code} — {store.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Note interne" htmlFor="transfer-note">
            <textarea
              id="transfer-note"
              value={note}
              disabled={!isDraft}
              onChange={(event) => setNote(event.target.value)}
              className={inputClassName}
              rows={3}
            />
          </FormField>
          {detailQuery.data?.cancelReason ? (
            <Alert tone="info">Motif d’annulation : {detailQuery.data.cancelReason}</Alert>
          ) : null}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Lignes</p>
            {isDraft && storeId && warehouseId ? (
              <p className="text-xs text-slate-500">
                Recherchez un article autorisé avec stock entrepôt &gt; 0 — le disponible s’affiche.
              </p>
            ) : null}
          </div>

          {isDraft ? (
            <FormField label="Ajouter un produit autorisé" htmlFor="transfer-product-search">
              <input
                id="transfer-product-search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                className={inputClassName}
                placeholder="Référence ou nom (min. 2 caractères)"
                disabled={!storeId || !warehouseId}
              />
            </FormField>
          ) : null}

          {isDraft && catalogQuery.data?.items.length ? (
            <ul className="overflow-hidden rounded-xl border border-slate-200 bg-black/25">
              {catalogQuery.data.items.map((product) => (
                <li key={product.productId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-100"
                    onClick={() => addProduct(product)}
                  >
                    <span>
                      <span className="font-mono text-xs text-slate-500">{product.reference}</span>
                      <span className="ml-2 text-slate-900">{product.name}</span>
                    </span>
                    <span className={`text-xs tabular-nums ${product.quantityAvailable > 0 ? "text-emerald-300" : "text-red-300"}`}>
                      Dispo {product.quantityAvailable}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto">
            {isDraft ? (
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pb-2">Produit</th>
                    <th className="w-24 pb-2">Demandé</th>
                    <th className="w-16 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {pagedDraftLines.map((line) => (
                    <tr key={line.productId} className="border-t border-slate-100">
                      <td className="py-2.5">
                        <p className="font-mono text-xs text-slate-500">{line.productReference}</p>
                        <p className="text-slate-900">{line.productName}</p>
                      </td>
                      <td className="py-2.5">
                        <input
                          type="number"
                          min={1}
                          value={line.quantityRequested}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.productId === line.productId
                                  ? { ...item, quantityRequested: Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                          className={inputClassName}
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          className="text-xs text-red-300 hover:underline"
                          onClick={() =>
                            setLines((current) => current.filter((item) => item.productId !== line.productId))
                          }
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pb-2">Produit</th>
                    <th className="w-24 pb-2">Demandé</th>
                    <th className="w-24 pb-2">Expédié</th>
                    <th className="w-28 pb-2">Reçu</th>
                    <th className="w-24 pb-2">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTransferItems.map((line) => {
                    const isReceiving =
                      !cashierReceiveOnly && (status === "SHIPPED" || status === "PARTIALLY_RECEIVED");
                    const received = isReceiving ? Number(receivedQty[line.productId] ?? 0) : line.quantityReceived;
                    const variance = isReceiving || status === "RECEIVED" ? received - line.quantityShipped : null;
                    return (
                      <tr key={line.productId} className="border-t border-slate-100">
                        <td className="py-2.5">
                          <p className="font-mono text-xs text-slate-500">{line.productReference}</p>
                          <p className="text-slate-900">{line.productName}</p>
                        </td>
                        <td className="py-2.5 tabular-nums">{line.quantityRequested}</td>
                        <td className="py-2.5 tabular-nums text-slate-600">{line.quantityShipped}</td>
                        <td className="py-2.5">
                          {isReceiving && canReceive ? (
                            <input
                              type="number"
                              min={0}
                              value={receivedQty[line.productId] ?? 0}
                              onChange={(event) =>
                                setReceivedQty((current) => ({
                                  ...current,
                                  [line.productId]: Number(event.target.value),
                                }))
                              }
                              className={inputClassName}
                            />
                          ) : (
                            <span className="tabular-nums">{line.quantityReceived}</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {variance === null ? (
                            <span className="text-slate-600">—</span>
                          ) : (
                            <span className={`tabular-nums ${variance === 0 ? "text-emerald-300" : "text-amber-300"}`}>
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {isDraft && lines.length > 0 ? (
            <div className="mt-3">
              <Pagination
                page={draftLinesPage}
                totalPages={draftLinesTotalPages}
                totalItems={draftLinesTotalItems}
                onPageChange={setDraftLinesPage}
                itemLabel="lignes"
              />
            </div>
          ) : null}
          {!isDraft && transferItems.length > 0 ? (
            <div className="mt-3">
              <Pagination
                page={transferItemsPage}
                totalPages={transferItemsTotalPages}
                totalItems={transferItemsTotalItems}
                onPageChange={setTransferItemsPage}
                itemLabel="lignes"
              />
            </div>
          ) : null}
          {lines.length === 0 && isDraft ? (
            <p className="text-sm text-slate-500">
              {!storeId
                ? "Choisissez d’abord la boutique, puis ajoutez des articles autorisés."
                : "Aucun article pour l’instant. Recherchez un produit déjà autorisé dans cette boutique — le disponible entrepôt s’affiche."}
            </p>
          ) : null}

          {!cashierReceiveOnly &&
          (status === "SHIPPED" || status === "PARTIALLY_RECEIVED") &&
          receivePreview.some((line) => line.variance !== 0) ? (
            <Alert tone="info">
              Écart détecté sur au moins une ligne. Le manquant restera sorti de l’entrepôt et devra être régularisé par un
              ajustement justifié.
            </Alert>
          ) : null}

          {cashierReceiveOnly && canAccuseReception ? (
            <Alert tone="info">
              Contrôlez chaque article reçu du camion ou du colis, puis cliquez sur « Accuser réception » pour mettre à jour le stock
              boutique.
            </Alert>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        {isNew && canCreate ? (
          <Button disabled={!canSubmitDraft || createMutation.isPending} onClick={() => void createMutation.mutateAsync()}>
            Créer le brouillon
          </Button>
        ) : null}

        {!isNew && isDraft && canCreate ? (
          <>
            <Button disabled={!canSubmitDraft || saveMutation.isPending} variant="ghost" onClick={() => void saveMutation.mutateAsync()}>
              Enregistrer
            </Button>
            <Button disabled={!canSubmitDraft || submitMutation.isPending} onClick={() => void submitMutation.mutateAsync()}>
              Soumettre pour validation
            </Button>
          </>
        ) : null}

        {status === "PENDING" && canValidate ? (
          <Button disabled={validateMutation.isPending} onClick={() => void handleValidate()}>
            Valider et réserver
          </Button>
        ) : null}

        {status === "VALIDATED" && canShip ? (
          <>
            <Button disabled={prepareMutation.isPending} onClick={() => void prepareMutation.mutateAsync()}>
              Passer en préparation
            </Button>
            <Button disabled={shipMutation.isPending} onClick={() => void handleShip()}>
              Expédier (déduire entrepôt)
            </Button>
          </>
        ) : null}

        {status === "PREPARING" && canShip ? (
          <Button disabled={shipMutation.isPending} onClick={() => void handleShip()}>
            Expédier (déduire entrepôt)
          </Button>
        ) : null}

        {canAccuseReception ? (
          <Button disabled={receiveMutation.isPending} onClick={() => setShowReceiveModal(true)}>
            Accuser réception
          </Button>
        ) : null}

        {canPrintShipFiche ? (
          <Button variant="ghost" disabled={shipMutation.isPending} onClick={handlePrintShipFiche}>
            Imprimer la fiche de transfert
          </Button>
        ) : null}

        {(status === "DRAFT" || status === "PENDING" || status === "VALIDATED" || status === "PREPARING") &&
        (canCreate || canValidate) &&
        !isNew ? (
          <div className="ml-auto flex min-w-[16rem] flex-1 flex-wrap items-center gap-2">
            {(status === "VALIDATED" || status === "PREPARING") && (
              <input
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Motif d’annulation"
                className={`${inputClassName} max-w-xs`}
              />
            )}
            <Button variant="danger" disabled={cancelMutation.isPending} onClick={() => void handleCancel()}>
              Annuler
            </Button>
          </div>
        ) : null}

        {status === "PENDING" && !canValidate ? (
          <Alert tone="info">La permission transfers.validate est requise pour réserver le stock.</Alert>
        ) : null}
      </div>

      {showReceiveModal && receiveModalTransfer ? (
        <TransferReceiveModal
          transfer={receiveModalTransfer}
          busy={receiveMutation.isPending}
          onClose={() => setShowReceiveModal(false)}
          onConfirm={(items) => receiveMutation.mutate(items)}
        />
      ) : null}
    </div>
  );
}
