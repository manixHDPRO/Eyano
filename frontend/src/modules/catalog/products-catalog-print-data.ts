import { fetchProducts } from "../../lib/api/products";
import type { PaginatedProducts, ProductListItem } from "../../lib/api/types";

const PRINT_PAGE_SIZE = 100;

export type ProductsCatalogPrintPayload = {
  generatedAt: string;
  items: ProductListItem[];
  total: number;
  stats: PaginatedProducts["stats"];
  filters: {
    search: string;
    categoryLabel: string | null;
  };
};

export async function loadProductsForCatalogPrint(params: {
  search?: string;
  categoryId?: string;
  categoryLabel?: string | null;
}): Promise<ProductsCatalogPrintPayload> {
  const first = await fetchProducts({
    page: 1,
    pageSize: PRINT_PAGE_SIZE,
    search: params.search?.trim() || undefined,
    categoryId: params.categoryId || undefined,
  });

  const items: ProductListItem[] = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    const batch = await fetchProducts({
      page,
      pageSize: PRINT_PAGE_SIZE,
      search: params.search?.trim() || undefined,
      categoryId: params.categoryId || undefined,
    });
    items.push(...batch.items);
  }

  return {
    generatedAt: new Date().toISOString(),
    items,
    total: first.total,
    stats: first.stats,
    filters: {
      search: params.search?.trim() ?? "",
      categoryLabel: params.categoryLabel ?? null,
    },
  };
}

export function productToBarcodeCatalogItem(product: ProductListItem) {
  if (!product.barcode) {
    return null;
  }
  return {
    id: product.id,
    reference: product.reference,
    name: product.name,
    brand: product.brand,
    photoUrl: product.photoUrl,
    status: product.status,
    officialPrice: product.officialPrice,
    finalPrice: product.finalPrice,
    barcode: product.barcode,
    printCount: 0,
    lastPrintedAt: null,
    updatedAt: product.updatedAt,
  };
}