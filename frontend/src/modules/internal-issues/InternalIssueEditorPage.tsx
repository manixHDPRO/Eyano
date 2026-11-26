import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button, ghostLinkClassName } from "../../components/ui/Button";
import { FormField, inputClassName, textareaClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  approveInternalIssue,
  cancelInternalIssue,
  createInternalIssue,
  fetchInternalIssue,
  fetchInternalIssueCatalog,
  fetchInternalIssueLocations,
  rejectInternalIssue,
  submitInternalIssue,
  updateInternalIssue,
} from "../../lib/api/internal-issues";
import type { InternalIssueDetail, InternalIssueReason, InternalIssueScopeType } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { InternalIssueTimeline } from "./InternalIssueTimeline";
import {
  internalIssueReasonLabel,
  internalIssueStatusLabel,
  internalIssueStatusTone,
  locationKeyFromOption,
  locationLabel,
  personName,
} from "./internal-issue-status";

const REASONS: InternalIssueReason[] = ["CLEANING", "MAINTENANCE", "INTERNAL_USE", "DAMAGED", "OTHER"];

export function InternalIssueEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast, confirm } = useToast();
  const { user } = useAuth();

  const canRequest = hasPermission(user, "internal_issues.request");
  const canValidate = hasPermission(user, "internal_issues.validate");

  const detailQuery = useQuery({
    queryKey: ["internal-issue", id],
    queryFn: () => fetchInternalIssue(id!),
    enabled: !isNew && Boolean(id),
  });

  const locationsQuery = useQuery({
    queryKey: ["internal-issue-locations"],
    queryFn: fetchInternalIssueLocations,
    enabled: isNew,
  });

  const [locationKey, setLocationKey] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reasonCode, setReasonCode] = useState<InternalIssueReason>("INTERNAL_USE");
  const [reasonText, setReasonText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const detail = detailQuery.data;

  const selectedLocation = useMemo(() => {
    const items = locationsQuery.data?.items ?? [];
    return items.find((row) => locationKeyFromOption(row) === locationKey);
  }, [locationsQuery.data, locationKey]);

  const scopeType: InternalIssueScopeType | undefined = isNew
    ? selectedLocation?.scopeType
    : detail?.scopeType;
  const warehouseId = isNew ? selectedLocation?.warehouse?.id : detail?.warehouse?.id;
  const storeId = isNew ? selectedLocation?.store?.id : detail?.store?.id;

  const catalogQuery = useQuery({
    queryKey: ["internal-issue-catalog", scopeType, warehouseId, storeId, productSearch],
    queryFn: () =>
      fetchInternalIssueCatalog({
        scopeType: scopeType!,
        warehouseId,
        storeId,
        search: productSearch.trim(),
      }),
    enabled: isNew && Boolean(scopeType) && productSearch.trim().length >= 2,
  });

  useEffect(() => {
    if (!detail) return;
    setQuantity(String(detail.quantity));
    setReasonCode(detail.reasonCode);
    setReasonText(detail.reasonText ?? "");
    setReviewNote(detail.reviewNote ?? "");
    setSelectedProductId(detail.productId);
  }, [detail]);

  async function invalidateLists() {
    await queryClient.invalidateQueries({ queryKey: ["internal-issues"] });
    await queryClient.invalidateQueries({ queryKey: ["internal-issues-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["internal-issue", id] });
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocation || !selectedProductId) {
        throw new Error("Choisissez un lieu et un produit.");
      }
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        throw new Error("Quantité invalide.");
      }
      if (reasonCode === "OTHER" && !reasonText.trim()) {
        throw new Error("Précisez le motif « Autre ».");
      }
      const payload =
        selectedLocation.scopeType === "WAREHOUSE"
          ? {
              scopeType: "WAREHOUSE" as const,
              warehouseId: selectedLocation.warehouse!.id,
              productId: selectedProductId,
              quantity: qty,
              reasonCode,
              reasonText: reasonText.trim() || undefined,
            }
          : {
              scopeType: "STORE" as const,
              storeId: selectedLocation.store!.id,
              productId: selectedProductId,
              quantity: qty,
              reasonCode,
              reasonText: reasonText.trim() || undefined,
            };
      return createInternalIssue(payload);
    },
    onSuccess: async (created) => {
      await invalidateLists();
      pushToast({ tone: "success", message: `Demande ${created.reference} créée.` });
      navigate(`/admin/internal-issues/${created.id}`, { replace: true });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Création impossible.") }),
  });

  async function runAction(label: string, action: () => Promise<InternalIssueDetail>) {
    try {
      await action();
      await invalidateLists();
      pushToast({ tone: "success", message: label });
    } catch (error) {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Action impossible.") });
    }
  }

  const isTerminal =
    detail?.status === "APPROVED" || detail?.status === "REJECTED" || detail?.status === "CANCELLED";
  const editableDraft = detail?.status === "DRAFT" && canRequest;

  const selectedCatalogProduct = catalogQuery.data?.items.find((row) => row.productId === selectedProductId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stocks"
        title={isNew ? "Nouvelle sortie interne" : detail?.reference ?? "Sortie interne"}
        description={
          isNew
            ? "Le stock physique ne bouge qu’après approbation. Choisissez le lieu, le produit et le motif."
            : detail
              ? locationLabel(detail)
              : "Chargement…"
        }
        actions={
          !isNew ? (
            <Link to="/admin/internal-issues" className={ghostLinkClassName}>
              ← Liste
            </Link>
          ) : null
        }
      />

      {!isNew && detail ? (
        <>
          <InternalIssueTimeline status={detail.status} />

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={internalIssueStatusLabel(detail.status)} tone={internalIssueStatusTone(detail.status)} />
            <span className="text-xs text-slate-500">
              Demandée par {personName(detail.requestedBy)} · {new Date(detail.createdAt).toLocaleString("fr-FR")}
            </span>
            {detail.reviewedBy ? (
              <span className="text-xs text-slate-500">
                Traitée par {personName(detail.reviewedBy)}
                {detail.reviewedAt ? ` · ${new Date(detail.reviewedAt).toLocaleString("fr-FR")}` : ""}
              </span>
            ) : null}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-[var(--color-eyano-panel)]/35 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Ligne de sortie</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoTile label="Produit" value={`${detail.productReference} — ${detail.productName}`} />
              <InfoTile label="Quantité" value={String(detail.quantity)} emphasis />
              <InfoTile label="Motif" value={internalIssueReasonLabel(detail.reasonCode)} />
              {detail.reasonText ? <InfoTile label="Précision" value={detail.reasonText} span /> : null}
              {detail.reviewNote ? <InfoTile label="Note de validation" value={detail.reviewNote} span /> : null}
            </div>
          </section>

          <ActionBar
            detail={detail}
            canRequest={canRequest}
            canValidate={canValidate}
            reviewNote={reviewNote}
            rejectNote={rejectNote}
            onReviewNoteChange={setReviewNote}
            onRejectNoteChange={setRejectNote}
            editableDraft={editableDraft}
            quantity={quantity}
            reasonCode={reasonCode}
            reasonText={reasonText}
            onQuantityChange={setQuantity}
            onReasonCodeChange={setReasonCode}
            onReasonTextChange={setReasonText}
            onSaveDraft={() =>
              runAction("Brouillon enregistré.", () =>
                updateInternalIssue(detail.id, {
                  quantity: Number(quantity),
                  reasonCode,
                  reasonText: reasonText.trim() || null,
                }),
              )
            }
            onSubmit={() => runAction("Demande soumise à validation.", () => submitInternalIssue(detail.id))}
            onApprove={() =>
              runAction("Sortie approuvée — stock déduit.", () =>
                approveInternalIssue(detail.id, reviewNote.trim() || undefined),
              )
            }
            onReject={() =>
              runAction("Demande rejetée.", () => rejectInternalIssue(detail.id, rejectNote.trim()))
            }
            onCancel={async () => {
              const ok = await confirm({
                title: "Annuler cette demande ?",
                message: "Aucun mouvement stock ne sera écrit.",
                confirmLabel: "Annuler la demande",
              });
              if (!ok) return;
              await runAction("Demande annulée.", () => cancelInternalIssue(detail.id));
            }}
            isTerminal={isTerminal}
          />
        </>
      ) : null}

      {isNew ? (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-[var(--color-eyano-panel)]/35 p-5">
          <FormField label="Lieu de sortie" htmlFor="internal-issue-location">
            <select
              id="internal-issue-location"
              value={locationKey}
              onChange={(event) => {
                setLocationKey(event.target.value);
                setSelectedProductId("");
              }}
              className={inputClassName}
            >
              <option value="">— Choisir —</option>
              {(locationsQuery.data?.items ?? []).map((option) => (
                <option key={locationKeyFromOption(option)} value={locationKeyFromOption(option)}>
                  {option.scopeType === "WAREHOUSE"
                    ? `Entrepôt ${option.warehouse?.code} — ${option.warehouse?.name}`
                    : `Boutique ${option.store?.code} — ${option.store?.name}`}
                </option>
              ))}
            </select>
          </FormField>

          {locationKey ? (
            <>
              <FormField
                label="Recherche produit"
                htmlFor="internal-issue-product-search"
                hint="Au moins 2 caractères — seuls les articles avec stock sur ce lieu"
              >
                <input
                  id="internal-issue-product-search"
                  type="search"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Référence ou nom…"
                  className={inputClassName}
                />
              </FormField>

              {catalogQuery.data && catalogQuery.data.items.length > 0 ? (
                <ul className="grid gap-2">
                  {catalogQuery.data.items.map((row) => {
                    const active = row.productId === selectedProductId;
                    return (
                      <li key={row.productId}>
                        <button
                          type="button"
                          onClick={() => setSelectedProductId(row.productId)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            active
                              ? "border-[var(--color-eyano-accent)]/60 bg-slate-100"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {row.reference} — {row.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Disponible {row.quantityAvailable} (physique {row.quantityOnHand}
                            {row.quantityReserved ? `, réservé ${row.quantityReserved}` : ""})
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : productSearch.trim().length >= 2 && catalogQuery.isFetched ? (
                <Alert tone="info">Aucun produit en stock pour cette recherche.</Alert>
              ) : null}

              {selectedCatalogProduct ? (
                <p className="text-xs text-emerald-300">
                  Sélection : {selectedCatalogProduct.reference} — max conseillé {selectedCatalogProduct.quantityAvailable}{" "}
                  unité(s)
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Quantité" htmlFor="internal-issue-qty">
                  <input
                    id="internal-issue-qty"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className={inputClassName}
                  />
                </FormField>

                <FormField label="Motif" htmlFor="internal-issue-reason">
                  <select
                    id="internal-issue-reason"
                    value={reasonCode}
                    onChange={(event) => setReasonCode(event.target.value as InternalIssueReason)}
                    className={inputClassName}
                  >
                    {REASONS.map((code) => (
                      <option key={code} value={code}>
                        {internalIssueReasonLabel(code)}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {reasonCode === "OTHER" ? (
                <FormField label="Précision du motif" htmlFor="internal-issue-reason-text">
                  <textarea
                    id="internal-issue-reason-text"
                    value={reasonText}
                    onChange={(event) => setReasonText(event.target.value)}
                    rows={3}
                    className={textareaClassName}
                  />
                </FormField>
              ) : null}
            </>
          ) : (
            <Alert tone="info">Sélectionnez d’abord un lieu (entrepôt ou boutique).</Alert>
          )}

          {canRequest ? (
            <Button
              type="button"
              disabled={createMutation.isPending || !locationKey || !selectedProductId}
              onClick={() => createMutation.mutate()}
            >
              Créer le brouillon
            </Button>
          ) : (
            <Alert tone="error">Permission « demander une sortie interne » requise.</Alert>
          )}
        </section>
      ) : null}

      {detailQuery.isError ? (
        <Alert tone="error">{formatApiErrorMessage(detailQuery.error, "Fiche introuvable.")}</Alert>
      ) : null}
    </div>
  );
}

function InfoTile({
  label,
  value,
  emphasis = false,
  span = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  span?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-3 py-3 ${span ? "md:col-span-2" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm ${emphasis ? "text-2xl font-semibold tabular-nums text-slate-900" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}

function ActionBar(props: {
  detail: InternalIssueDetail;
  canRequest: boolean;
  canValidate: boolean;
  editableDraft: boolean;
  isTerminal: boolean;
  quantity: string;
  reasonCode: InternalIssueReason;
  reasonText: string;
  reviewNote: string;
  rejectNote: string;
  onQuantityChange: (value: string) => void;
  onReasonCodeChange: (value: InternalIssueReason) => void;
  onReasonTextChange: (value: string) => void;
  onReviewNoteChange: (value: string) => void;
  onRejectNoteChange: (value: string) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  if (props.isTerminal) {
    return (
      <Alert tone={props.detail.status === "APPROVED" ? "success" : "info"}>
        {props.detail.status === "APPROVED"
          ? "Cette sortie a généré un mouvement INTERNAL_ISSUE — le stock a été diminué."
          : "Demande close sans impact stock."}
      </Alert>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-black/25 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Actions</h2>

      {props.editableDraft ? (
        <div className="mt-4 space-y-4 border-b border-slate-200 pb-4">
          <p className="text-xs text-slate-400">Modifiez le brouillon avant soumission.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Quantité" htmlFor="edit-qty">
              <input
                id="edit-qty"
                type="number"
                min={1}
                value={props.quantity}
                onChange={(event) => props.onQuantityChange(event.target.value)}
                className={inputClassName}
              />
            </FormField>
            <FormField label="Motif" htmlFor="edit-reason">
              <select
                id="edit-reason"
                value={props.reasonCode}
                onChange={(event) => props.onReasonCodeChange(event.target.value as InternalIssueReason)}
                className={inputClassName}
              >
                {REASONS.map((code) => (
                  <option key={code} value={code}>
                    {internalIssueReasonLabel(code)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {props.reasonCode === "OTHER" ? (
            <FormField label="Précision" htmlFor="edit-reason-text">
              <textarea
                id="edit-reason-text"
                value={props.reasonText}
                onChange={(event) => props.onReasonTextChange(event.target.value)}
                rows={2}
                className={textareaClassName}
              />
            </FormField>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={props.onSaveDraft}>
              Enregistrer
            </Button>
            <Button type="button" onClick={props.onSubmit}>
              Soumettre à validation
            </Button>
            <Button type="button" variant="ghost" onClick={props.onCancel}>
              Annuler la demande
            </Button>
          </div>
        </div>
      ) : null}

      {props.detail.status === "PENDING" && props.canValidate ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-amber-200/90">
            Le stock reste intact jusqu’à votre décision. En cas d’approbation, la quantité sera déduite immédiatement.
          </p>
          <FormField label="Note d’approbation (optionnelle)" htmlFor="review-note">
            <textarea
              id="review-note"
              value={props.reviewNote}
              onChange={(event) => props.onReviewNoteChange(event.target.value)}
              rows={2}
              className={textareaClassName}
            />
          </FormField>
          <FormField label="Motif de rejet" htmlFor="reject-note" hint="Obligatoire pour rejeter">
            <textarea
              id="reject-note"
              value={props.rejectNote}
              onChange={(event) => props.onRejectNoteChange(event.target.value)}
              rows={2}
              className={textareaClassName}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={props.onApprove}>
              Approuver la sortie
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={props.rejectNote.trim().length < 3}
              onClick={props.onReject}
            >
              Rejeter
            </Button>
            {props.canRequest ? (
              <Button type="button" variant="ghost" onClick={props.onCancel}>
                Annuler
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {props.detail.status === "DRAFT" && !props.canRequest ? (
        <Alert tone="info">Cette demande est en brouillon — en attente du demandeur.</Alert>
      ) : null}

      {props.detail.status === "PENDING" && !props.canValidate ? (
        <Alert tone="info">Demande soumise — en attente d’une validation centrale.</Alert>
      ) : null}
    </section>
  );
}