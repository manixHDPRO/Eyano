import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName } from "../../components/ui/form-styles";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchCategoryTree } from "../../lib/api/categories";
import { fetchProducts } from "../../lib/api/products";
import type { ProductListItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { formatUsd } from "./money";

const PAGE_SIZE = 25;

export function ProductsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = hasPermission(user, "products.manage");
  const canBarcodes =
    hasPermission(user, "barcodes.print") || hasPermission(user, "products.manage");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const categoryId = searchParams.get("categoryId") ?? "";

  const productsQuery = useQuery({
    queryKey: ["products", page, PAGE_SIZE, search, categoryId],
    queryFn: () =>
      fetchProducts({
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
        categoryId: categoryId || undefined,
      }),
  });

  const treeQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategoryTree,
  });

  const categoryOptions = useMemo(() => flattenLeaves(treeQuery.data?.items ?? []), [treeQuery.data?.items]);
  const errorMessage = productsQuery.isError
    ? formatApiErrorMessage(productsQuery.error, "Chargement impossible.")
    : null;
  const items = productsQuery.data?.items ?? [];

  function setCategoryFilter(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set("categoryId", next);
    } else {
      params.delete("categoryId");
    }
    setSearchParams(params, { replace: true });
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <a
        href="#catalogue-produits"
        className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-xs focus:font-medium focus:text-slate-900"
      >
        Aller au tableau du catalogue
      </a>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catalogue central des produits</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Création centralisée des articles, affectation aux boutiques et seuils d&apos;alerte.
          </p>
        </div>
        {canManage || canBarcodes ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5">
            {canBarcodes ? (
              <Link
                to="/admin/barcodes"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <BarcodeIcon />
                Codes-barres
              </Link>
            ) : null}
            {canManage ? (
              <>
                <Link
                  to="/admin/categories"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FolderPlusIcon />
                  Catégorie
                </Link>
                <Link
                  to="/admin/products/new"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <PlusIcon />
                  Nouveau produit
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Rechercher par référence, code-barres ou désignation..."
            className={`${filterInputClassName} pl-9`}
            id="catalogue-produits"
          />
        </div>
        <select
          value={categoryId}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className={`${filterInputClassName} sm:max-w-[220px]`}
          aria-label="Filtrer par catégorie"
        >
          <option value="">Toutes les catégories</option>
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {productsQuery.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-medium text-slate-900">Aucun article dans cette vue</p>
          {canManage ? (
            <Link
              to="/admin/products/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <PlusIcon />
              Nouveau produit
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium">Catégorie / Provenance</th>
                  <th className="px-4 py-3 text-right font-medium">Prix achat</th>
                  <th className="px-4 py-3 text-right font-medium">Remise</th>
                  <th className="px-4 py-3 text-right font-medium">Entrepôt</th>
                  <th className="px-4 py-3 font-medium">Boutiques autorisées</th>
                  <th className="px-4 py-3 text-right font-medium">Seuil alerte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((product) => (
                  <ProductRow key={product.id} product={product} onOpen={() => navigate(`/admin/products/${product.id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {productsQuery.data && items.length > 0 ? (
        <Pagination
          page={productsQuery.data.page}
          totalPages={productsQuery.data.totalPages}
          totalItems={productsQuery.data.total}
          onPageChange={setPage}
          itemLabel="articles"
        />
      ) : null}
    </div>
  );
}

function ProductRow({ product, onOpen }: { product: ProductListItem; onOpen: () => void }) {
  const storeSummary =
    product.authorizedStores.length > 0
      ? product.authorizedStores.map((store) => `${store.code} (${store.stock})`).join(" · ")
      : "Aucune";

  const categoryLine = product.category.parentName
    ? `${product.category.parentName} · ${product.category.name}`
    : product.category.name;
  const originLine = [product.brand, product.originCountry].filter(Boolean).join(" · ");

  return (
    <tr className="cursor-pointer transition hover:bg-slate-50/70" onClick={onOpen}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            {product.photoUrl ? (
              <img
                src={product.photoUrl}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-slate-400">
                <PackageIcon />
              </div>
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{product.name}</div>
            <div className="font-mono text-[11px] text-slate-500">
              {product.reference}
              {product.barcode ? ` · ${product.barcode.code}` : ""}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">
        <div>{categoryLine}</div>
        {originLine ? <div className="text-[11px] text-slate-400">{originLine}</div> : null}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">{formatUsd(product.purchasePrice)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
        {formatPercent(product.discountPercent)}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
        {product.warehouseStock} u.
      </td>
      <td className="px-4 py-3 text-slate-600">{storeSummary}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
        {product.alertThresholdDisplay} u.
      </td>
    </tr>
  );
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(rounded)}%`;
}

function flattenLeaves(nodes: Array<{ id: string; name: string; children: Array<{ id: string; name: string; children: unknown[] }> }>) {
  const options: Array<{ id: string; label: string }> = [];
  for (const root of nodes) {
    if (root.children.length === 0) {
      options.push({ id: root.id, label: root.name });
      continue;
    }
    for (const child of root.children) {
      options.push({ id: child.id, label: `${root.name} · ${child.name}` });
    }
  }
  return options;
}

function PlusIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BarcodeIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7v10M8 5v14M11 8v8M14 5v14M17 8v8M20 7v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h5l1 2h10v9H4V8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 4 7v10l8 4 8-4V7l-8-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 11v10M4 7l8 4 8-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}