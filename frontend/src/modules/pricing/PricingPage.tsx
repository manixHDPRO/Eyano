import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FormField, inputClassName, textareaClassName } from "../../components/ui/FormField";
import { filterInputClassName } from "../../components/ui/form-styles";
import { Pagination } from "../../components/ui/Pagination";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  fetchPricingOverview,
  fetchProductPricingTimeline,
  updateProductDiscount,
  updateProductPrices,
} from "../../lib/api/pricing";
import type { PricingOverviewItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { computeFinalPrice, formatUsd } from "../catalog/money";
import { productStatusLabel, productStatusTone } from "../catalog/product-status";
import { ProductPricingTimelinePanel } from "./ProductPricingTimeline";

export function PricingPage() {
  const { user } = useAuth();
  const canUpdatePrices = hasPermission(user, "prices.update");
  const canUpdateDiscounts = hasPermission(user, "discounts.update");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const overviewQuery = useQuery({
    queryKey: ["pricing-overview", page, search],
    queryFn: () =>
      fetchPricingOverview({
        page,
        pageSize: 12,
        search: search.trim() || undefined,
      }),
  });

  const items = overviewQuery.data?.items ?? [];
  const activeId = selectedId ?? items[0]?.id ?? null;
  const activeItem = items.find((item) => item.id === activeId) ?? null;

  const timelineQuery = useQuery({
    queryKey: ["pricing-timeline", activeId],
    queryFn: () => fetchProductPricingTimeline(activeId!),
    enabled: Boolean(activeId),
  });

  const errorMessage = overviewQuery.isError
    ? formatApiErrorMessage(overviewQuery.error, "Chargement impossible.")
    : null;

  const onSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pricing-overview"] });
    if (activeId) {
      await queryClient.invalidateQueries({ queryKey: ["pricing-timeline", activeId] });
    }
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    pushToast({ tone: "success", message: "Tarif historisé et cache mis à jour." });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <Link to="/admin/products" className="inline-flex text-xs font-medium text-slate-500 hover:text-slate-800">
        ← Retour au catalogue
      </Link>

      <ConfigHeader total={overviewQuery.data?.total} isLoading={overviewQuery.isLoading} />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,22rem)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Articles</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Sélectionnez un produit pour historiser un tarif ou consulter les périodes passées.
          </p>
          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSelectedId(null);
              }}
              placeholder="Référence, nom ou marque…"
              className={`${filterInputClassName} pl-9`}
              autoComplete="off"
            />
          </div>
          <ul className="mt-3 max-h-[min(52vh,28rem)] divide-y divide-slate-100 overflow-y-auto">
            {overviewQuery.isLoading && items.length === 0 ? (
              <li className="py-10 text-center text-sm text-slate-400">Chargement des articles…</li>
            ) : null}
            {items.map((item) => (
              <PricingRow
                key={item.id}
                item={item}
                active={item.id === activeId}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
            {items.length === 0 && !overviewQuery.isLoading ? (
              <li className="py-10 text-center text-sm text-slate-500">
                {search.trim() ? "Aucun article ne correspond à cette recherche." : "Aucun produit pour le moment."}
              </li>
            ) : null}
          </ul>
          {overviewQuery.data ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Pagination
                page={overviewQuery.data.page}
                totalPages={overviewQuery.data.totalPages}
                totalItems={overviewQuery.data.total}
                onPageChange={setPage}
                itemLabel="articles"
              />
            </div>
          ) : null}
        </section>

        <section className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {!activeId ? (
            <EmptyPanel message="Choisissez un article dans la liste." />
          ) : timelineQuery.isLoading ? (
            <EmptyPanel message="Chargement du tarif et de l’historique…" loading />
          ) : timelineQuery.isError || !timelineQuery.data ? (
            <Alert tone="error">
              {formatApiErrorMessage(timelineQuery.error, "Tarif indisponible pour cet article.")}
            </Alert>
          ) : (
            <TariffEditor
              productId={activeId}
              snapshot={timelineQuery.data.product}
              listHint={activeItem}
              canUpdatePrices={canUpdatePrices}
              canUpdateDiscounts={canUpdateDiscounts}
              onSaved={onSaved}
              onError={(caught) => {
                pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Modification impossible.") });
              }}
            />
          )}
        </section>
      </div>

      {activeId && timelineQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Chargement de l’historique tarifaire…
        </div>
      ) : null}

      {activeId && timelineQuery.data && !timelineQuery.isError ? (
        <ProductPricingTimelinePanel productId={activeId} compact />
      ) : null}
    </div>
  );
}

function ConfigHeader({ total, isLoading }: { total?: number; isLoading: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Catalogue</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prix &amp; remises</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Historique officiel des tarifs (palier 9). Chaque changement clôture la ligne ouverte, recalcule le cache
          produit et alimente l&apos;audit — jamais le caissier.
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500">
          Prix final = arrondi half-up du prix officiel après remise (%). Le total caisse multipliera ce prix unitaire
          déjà arrondi.
        </p>
      </div>
      <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Articles</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
          {isLoading && total === undefined ? "…" : (total ?? "—")}
        </p>
      </div>
    </div>
  );
}

function EmptyPanel({ message, loading = false }: { message: string; loading?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-dashed p-8 text-center text-sm ${
        loading ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 text-slate-500"
      }`}
    >
      {message}
    </div>
  );
}

function PricingRow({
  item,
  active,
  onSelect,
}: {
  item: PricingOverviewItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition ${
          active ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-slate-50"
        }`}
      >
        <StatusBadge label={productStatusLabel(item.status)} tone={productStatusTone(item.status)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
          <p className="truncate font-mono text-[11px] text-slate-500">{item.reference}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {item.priceHistoryCount} prix · {item.discountHistoryCount} remises
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-800">{formatUsd(item.finalPrice)}</p>
          {item.discountPercent > 0 ? (
            <p className="text-[10px] font-medium text-emerald-700">−{item.discountPercent} %</p>
          ) : null}
        </div>
      </button>
    </li>
  );
}

type TariffEditorProps = {
  productId: string;
  listHint: PricingOverviewItem | null;
  snapshot: {
    purchasePrice: number;
    officialPrice: number;
    discountPercent: number;
    finalPrice: number;
    reference: string;
    name: string;
  };
  canUpdatePrices: boolean;
  canUpdateDiscounts: boolean;
  onSaved: () => Promise<void>;
  onError: (error: unknown) => void;
};

function TariffEditor({
  productId,
  listHint,
  snapshot,
  canUpdatePrices,
  canUpdateDiscounts,
  onSaved,
  onError,
}: TariffEditorProps) {
  const [purchasePrice, setPurchasePrice] = useState(snapshot.purchasePrice.toFixed(2));
  const [officialPrice, setOfficialPrice] = useState(snapshot.officialPrice.toFixed(2));
  const [discountPercent, setDiscountPercent] = useState(String(snapshot.discountPercent));
  const [priceReason, setPriceReason] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  useEffect(() => {
    setPurchasePrice(snapshot.purchasePrice.toFixed(2));
    setOfficialPrice(snapshot.officialPrice.toFixed(2));
    setDiscountPercent(String(snapshot.discountPercent));
    setPriceReason("");
    setDiscountReason("");
  }, [snapshot.purchasePrice, snapshot.officialPrice, snapshot.discountPercent, productId]);

  const previewFinal = useMemo(
    () => computeFinalPrice(Number.parseFloat(officialPrice) || 0, Number.parseFloat(discountPercent) || 0),
    [discountPercent, officialPrice],
  );

  const priceMutation = useMutation({
    mutationFn: () =>
      updateProductPrices(productId, {
        purchasePrice: Number.parseFloat(purchasePrice) || 0,
        officialPrice: Number.parseFloat(officialPrice) || 0,
        reason: priceReason.trim() || undefined,
      }),
    onSuccess: async () => {
      setPriceReason("");
      await onSaved();
    },
    onError,
  });

  const discountMutation = useMutation({
    mutationFn: () =>
      updateProductDiscount(productId, {
        percent: Number.parseFloat(discountPercent) || 0,
        reason: discountReason.trim() || undefined,
      }),
    onSuccess: async () => {
      setDiscountReason("");
      await onSaved();
    },
    onError,
  });

  const priceDirty =
    purchasePrice !== snapshot.purchasePrice.toFixed(2) || officialPrice !== snapshot.officialPrice.toFixed(2);
  const discountDirty = discountPercent !== String(snapshot.discountPercent);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Tarif courant</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{snapshot.reference}</p>
            <p className="mt-0.5 line-clamp-2 text-base font-medium text-slate-900">{snapshot.name}</p>
          </div>
          <Link
            to={`/admin/products/${productId}`}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Ouvrir la fiche
          </Link>
        </div>
        {listHint ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge label={productStatusLabel(listHint.status)} tone={productStatusTone(listHint.status)} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aperçu prix final</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatUsd(previewFinal)}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Enregistré : {formatUsd(snapshot.finalPrice)} — l&apos;API fera foi en caisse.
        </p>
      </div>

      <fieldset className="mt-5 space-y-4" disabled={!canUpdatePrices && !canUpdateDiscounts}>
        <legend className="sr-only">Modifier le tarif</legend>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Prix (achat / officiel)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Prix d’achat (USD)" htmlFor="pricing-purchase">
              <input
                id="pricing-purchase"
                type="number"
                min={0}
                step="0.01"
                value={purchasePrice}
                onChange={(event) => setPurchasePrice(event.target.value)}
                className={inputClassName}
                disabled={!canUpdatePrices}
              />
            </FormField>
            <FormField label="Prix officiel (USD)" htmlFor="pricing-official">
              <input
                id="pricing-official"
                type="number"
                min={0}
                step="0.01"
                value={officialPrice}
                onChange={(event) => setOfficialPrice(event.target.value)}
                className={inputClassName}
                disabled={!canUpdatePrices}
              />
            </FormField>
          </div>
          {canUpdatePrices ? (
            <FormField label="Motif (prix)" htmlFor="pricing-price-reason">
              <textarea
                id="pricing-price-reason"
                rows={2}
                value={priceReason}
                onChange={(event) => setPriceReason(event.target.value)}
                className={textareaClassName}
                placeholder="Optionnel — visible dans l’historique"
              />
            </FormField>
          ) : null}
          {canUpdatePrices ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!priceDirty || priceMutation.isPending}
              onClick={() => void priceMutation.mutateAsync()}
            >
              Historiser le prix
            </Button>
          ) : (
            <p className="text-xs text-slate-500">Vous n&apos;avez pas la permission de modifier les prix.</p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Remise produit</h3>
          <FormField label="Remise %" htmlFor="pricing-discount" className="mt-3">
            <input
              id="pricing-discount"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={discountPercent}
              onChange={(event) => setDiscountPercent(event.target.value)}
              className={inputClassName}
              disabled={!canUpdateDiscounts}
            />
          </FormField>
          {canUpdateDiscounts ? (
            <FormField label="Motif (remise)" htmlFor="pricing-discount-reason" className="mt-3">
              <textarea
                id="pricing-discount-reason"
                rows={2}
                value={discountReason}
                onChange={(event) => setDiscountReason(event.target.value)}
                className={textareaClassName}
                placeholder="Promotion, liquidation…"
              />
            </FormField>
          ) : null}
          {canUpdateDiscounts ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full sm:w-auto"
              disabled={!discountDirty || discountMutation.isPending}
              onClick={() => void discountMutation.mutateAsync()}
            >
              Historiser la remise
            </Button>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Vous n&apos;avez pas la permission de modifier les remises.</p>
          )}
        </div>
      </fieldset>
    </div>
  );
}

function SearchIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}