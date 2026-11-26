import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName } from "../../components/ui/form-styles";
import { Pagination } from "../../components/ui/Pagination";
import { useToast } from "../../components/ui/Toast";
import {
  fetchBarcodes,
  generateMissingBarcodes,
  generateProductBarcode,
  printBarcodes,
} from "../../lib/api/barcodes";
import { formatApiErrorMessage } from "../../lib/api/errors";
import type { BarcodeCatalogItem, BarcodeCoverage } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { ProductPhoto } from "../catalog/ProductPhoto";
import { formatUsd } from "../catalog/money";
import { productStatusLabel, productStatusTone } from "../catalog/product-status";
import { BarcodeLabel } from "./BarcodeLabel";
import { BarcodePrintJournal } from "./BarcodePrintJournal";
import { BarcodePrintSheet } from "./BarcodePrintSheet";
import { Code128Bars } from "./Code128Bars";
import { coverageLabel, formatPrintWhen } from "./barcode-display";
import { BARCODE_LABELS_PER_A4 } from "./barcode-print-sheet.constants";
import { waitThenPrint } from "./print-browser";

type WorkspaceTab = "labels" | "journal";

const COVERAGE_OPTIONS: BarcodeCoverage[] = ["ALL", "CODED", "MISSING"];

export function BarcodesPage() {
  const { user } = useAuth();
  const canPrint = hasPermission(user, "barcodes.print");
  const canGenerate = hasPermission(user, "products.manage");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState<BarcodeCoverage>("ALL");
  const [tab, setTab] = useState<WorkspaceTab>("labels");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("productId"));
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [copies, setCopies] = useState(1);
  const copiesSafe = Math.min(BARCODE_LABELS_PER_A4, Math.max(1, copies));
  const [printJob, setPrintJob] = useState<{ items: BarcodeCatalogItem[]; copies: number } | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["barcodes", page, search, coverage],
    queryFn: () =>
      fetchBarcodes({
        page,
        pageSize: 12,
        search: search.trim() || undefined,
        coverage,
      }),
  });

  const items = catalogQuery.data?.items ?? [];
  const stats = catalogQuery.data?.stats;
  const activeId = selectedId && items.some((item) => item.id === selectedId) ? selectedId : (items[0]?.id ?? null);
  const active = items.find((item) => item.id === activeId) ?? null;
  const checkedItems = items.filter((item) => checkedIds.includes(item.id));
  const printTargets = checkedItems.length > 0 ? checkedItems : active ? [active] : [];
  const printableTargets = printTargets.filter((item) => item.barcode);
  const missingInSelection = printTargets.filter((item) => !item.barcode);

  useEffect(() => {
    const fromUrl = searchParams.get("productId");
    if (fromUrl) {
      setSelectedId(fromUrl);
    }
  }, [searchParams]);

  const errorMessage = catalogQuery.isError
    ? formatApiErrorMessage(catalogQuery.error, "Chargement impossible.")
    : null;

  const generateOne = useMutation({
    mutationFn: (productId: string) => generateProductBarcode(productId),
    onSuccess: async (item) => {
      await invalidateCatalog(queryClient);
      setSelectedId(item.id);
      pushToast({ tone: "success", message: `Code ${item.barcode?.code ?? ""} attribué.` });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Génération impossible.") });
    },
  });

  const generateMissing = useMutation({
    mutationFn: generateMissingBarcodes,
    onSuccess: async (result) => {
      await invalidateCatalog(queryClient);
      pushToast({
        tone: "success",
        message:
          result.generated === 0
            ? "Tous les articles ont déjà un code."
            : `${result.generated} code${result.generated > 1 ? "s" : ""} Code 128 généré${result.generated > 1 ? "s" : ""}.`,
      });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Génération groupée impossible.") });
    },
  });

  const printMutation = useMutation({
    mutationFn: () =>
      printBarcodes({
        productIds: printableTargets.map((item) => item.id),
        copies: copiesSafe,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["barcode-print-logs"] });
      await invalidateCatalog(queryClient);
      setPrintJob({ items: result.items, copies: result.copies });
      await waitThenPrint();
      pushToast({
        tone: "success",
        message:
          result.context === "BATCH"
            ? `Lot journalisé — ${result.items.length} articles × ${result.copies}.`
            : `Étiquette journalisée (${result.copies} copie${result.copies > 1 ? "s" : ""}).`,
      });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Impression impossible.") });
    },
  });

  const allVisibleChecked = items.length > 0 && items.every((item) => checkedIds.includes(item.id));

  function toggleChecked(id: string) {
    setCheckedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAllVisible() {
    if (allVisibleChecked) {
      setCheckedIds((current) => current.filter((id) => !items.some((item) => item.id === id)));
      return;
    }
    setCheckedIds((current) => [...new Set([...current, ...items.map((item) => item.id)])]);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <Link to="/admin/products" className="inline-flex text-xs font-medium text-slate-500 hover:text-slate-800">
        ← Retour au catalogue
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Codes-barres Code 128</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Un identifiant par article. Imprimez une étiquette ou un lot : la réimpression est journalisée, elle ne
            crée jamais un nouveau code.
          </p>
        </div>
        {canGenerate && (stats?.missing ?? 0) > 0 ? (
          <button
            type="button"
            onClick={() => void generateMissing.mutateAsync()}
            disabled={generateMissing.isPending}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {generateMissing.isPending ? "Génération…" : "Générer les codes manquants"}
          </button>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Articles" value={stats?.total ?? "—"} hint="Catalogue visible" />
        <StatCard label="Codés" value={stats?.coded ?? "—"} hint="Code 128 actif" accent />
        <StatCard label="Sans code" value={stats?.missing ?? "—"} hint="À générer avant étiquette" />
      </section>

      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
        <TabButton active={tab === "labels"} onClick={() => setTab("labels")}>
          Étiquettes
        </TabButton>
        <TabButton active={tab === "journal"} onClick={() => setTab("journal")}>
          Journal
        </TabButton>
      </div>

      {tab === "journal" ? (
        <BarcodePrintJournal productId={activeId} />
      ) : (
        <>
          {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,22rem)]">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Articles</h2>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} className="rounded border-slate-300" />
                  Page entière
                </label>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">Nom, référence, marque ou code scanné.</p>
              <div className="relative mt-3">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                    setSelectedId(null);
                    setSearchParams({}, { replace: true });
                  }}
                  placeholder="Libellé, référence ou code-barres…"
                  className={`${filterInputClassName} pl-9`}
                  autoComplete="off"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {COVERAGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setCoverage(option);
                      setPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      coverage === option
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {coverageLabel(option)}
                  </button>
                ))}
              </div>
              <ul className="mt-3 max-h-[min(52vh,28rem)] divide-y divide-slate-100 overflow-y-auto">
                {items.map((item) => (
                  <BarcodeRow
                    key={item.id}
                    item={item}
                    active={item.id === activeId}
                    checked={checkedIds.includes(item.id)}
                    onCheck={() => toggleChecked(item.id)}
                    onSelect={() => {
                      setSelectedId(item.id);
                      setSearchParams({ productId: item.id }, { replace: true });
                    }}
                  />
                ))}
                {items.length === 0 && !catalogQuery.isLoading ? (
                  <li className="py-10 text-center text-sm text-slate-500">
                    {search.trim() || coverage !== "ALL"
                      ? "Aucun article ne correspond à ces filtres."
                      : "Aucun produit pour le moment."}
                  </li>
                ) : null}
              </ul>
              {catalogQuery.data ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Pagination
                    page={catalogQuery.data.page}
                    totalPages={catalogQuery.data.totalPages}
                    totalItems={catalogQuery.data.total}
                    onPageChange={setPage}
                    itemLabel="articles"
                  />
                </div>
              ) : null}
            </section>

            <section className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              {active ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <ProductPhoto url={active.photoUrl} name={active.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-slate-500">{active.reference}</p>
                      <h2 className="line-clamp-2 text-base font-semibold text-slate-900">{active.name}</h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge label={productStatusLabel(active.status)} tone={productStatusTone(active.status)} />
                        <span className="text-xs font-mono tabular-nums text-slate-600">{formatUsd(active.finalPrice)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    {active.barcode ? (
                      <div className="mx-auto w-full max-w-[19rem] rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                        <BarcodeLabel
                          name={active.name}
                          reference={active.reference}
                          code={active.barcode.code}
                          price={active.finalPrice}
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-center">
                        <p className="text-sm font-medium text-amber-900">Pas encore de code</p>
                        <p className="mt-1 text-xs text-amber-800/80">
                          Générez un Code 128 unique. Il restera le même à chaque réimpression.
                        </p>
                        {canGenerate ? (
                          <button
                            type="button"
                            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            onClick={() => void generateOne.mutateAsync(active.id)}
                            disabled={generateOne.isPending}
                          >
                            {generateOne.isPending ? "Génération…" : "Générer le code"}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {active.barcode ? (
                    <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-700">Étiquettes (copies)</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="size-7 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                            onClick={() => setCopies((value) => Math.max(1, value - 1))}
                            aria-label="Retirer une copie"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={BARCODE_LABELS_PER_A4}
                            value={copiesSafe}
                            onChange={(event) => setCopies(Number.parseInt(event.target.value, 10) || 1)}
                            className="w-12 rounded-md border border-slate-300 py-1 text-center font-mono text-xs tabular-nums"
                          />
                          <button
                            type="button"
                            className="size-7 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                            onClick={() => setCopies((value) => Math.min(BARCODE_LABELS_PER_A4, value + 1))}
                            aria-label="Ajouter une copie"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {canPrint ? (
                        <button
                          type="button"
                          className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                          disabled={printMutation.isPending || printableTargets.length === 0}
                          onClick={() => void printMutation.mutateAsync()}
                        >
                          {printMutation.isPending
                            ? "Impression…"
                            : checkedItems.length > 1
                              ? `Imprimer le lot (${printableTargets.length})`
                              : "Imprimer l’étiquette"}
                        </button>
                      ) : (
                        <p className="text-slate-500">L’impression requiert la permission barcodes.print.</p>
                      )}
                      {missingInSelection.length > 0 ? (
                        <p className="text-amber-800">
                          {missingInSelection.length} article{missingInSelection.length > 1 ? "s" : ""} sans code ignoré
                          {missingInSelection.length > 1 ? "s" : ""} dans le lot.
                        </p>
                      ) : null}
                      <p className="leading-relaxed text-slate-500">
                        Feuille A4 : jusqu’à {BARCODE_LABELS_PER_A4} étiquettes (grille 9×20).
                      </p>
                      <p className="text-slate-500">
                        {active.printCount > 0
                          ? `${active.printCount} impression${active.printCount > 1 ? "s" : ""} · dernière ${formatPrintWhen(active.lastPrintedAt ?? active.barcode.createdAt)}`
                          : "Jamais imprimé — le premier passage sera journalisé."}
                      </p>
                      <Link to={`/admin/products/${active.id}`} className="inline-flex font-medium text-slate-700 underline-offset-2 hover:underline">
                        Ouvrir la fiche article
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Sélectionnez un article pour prévisualiser l’étiquette.
                </div>
              )}
            </section>
          </div>
        </>
      )}

      <BarcodePrintSheet job={printJob} />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number | string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border px-4 py-3 ${
        accent ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
    </article>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function BarcodeRow({
  item,
  active,
  checked,
  onCheck,
  onSelect,
}: {
  item: BarcodeCatalogItem;
  active: boolean;
  checked: boolean;
  onCheck: () => void;
  onSelect: () => void;
}) {
  return (
    <li>
      <div
        className={`flex items-center gap-3 rounded-lg px-2 py-2 transition ${
          active ? "border border-slate-200 bg-slate-50" : "border border-transparent hover:bg-slate-50"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          onClick={(event) => event.stopPropagation()}
          className="accent-[var(--color-eyano-accent)]"
          aria-label={`Sélectionner ${item.reference}`}
        />
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="relative size-11 overflow-hidden rounded-lg bg-slate-50">
            <ProductPhoto url={item.photoUrl} name={item.name} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
            <p className="truncate font-mono text-[11px] text-slate-500">{item.reference}</p>
          </div>
          <div className="hidden w-28 shrink-0 sm:block">
            {item.barcode ? (
              <div className="h-8 overflow-hidden rounded-sm bg-white">
                <Code128Bars code={item.barcode.code} height={32} className="h-8" />
              </div>
            ) : (
              <span className="text-[11px] font-medium text-amber-700">Sans code</span>
            )}
          </div>
        </button>
      </div>
    </li>
  );
}

async function invalidateCatalog(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["barcodes"] });
  await queryClient.invalidateQueries({ queryKey: ["products"] });
}

function SearchIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
