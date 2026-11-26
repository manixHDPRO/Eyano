import { apiRequest } from "./client";
import type {
  BarcodeCatalogItem,
  BarcodeCoverage,
  BarcodeLookup,
  GenerateMissingBarcodesResult,
  PaginatedBarcodeCatalog,
  PaginatedBarcodePrintLogs,
  PrintBarcodesResult,
  ProductStatus,
} from "./types";

export type ListBarcodesParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ProductStatus | "";
  coverage?: BarcodeCoverage;
};

export function fetchBarcodes(params: ListBarcodesParams = {}): Promise<PaginatedBarcodeCatalog> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.coverage && params.coverage !== "ALL") query.set("coverage", params.coverage);
  const suffix = query.toString();
  return apiRequest(`/barcodes${suffix ? `?${suffix}` : ""}`);
}

export function lookupBarcode(code: string, storeId?: string): Promise<BarcodeLookup> {
  const query = new URLSearchParams({ code: code.trim() });
  if (storeId) {
    query.set("storeId", storeId);
  }
  return apiRequest(`/barcodes/lookup?${query.toString()}`);
}

export function fetchBarcodePrintLogs(params: {
  page?: number;
  pageSize?: number;
  productId?: string;
} = {}): Promise<PaginatedBarcodePrintLogs> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.productId) query.set("productId", params.productId);
  const suffix = query.toString();
  return apiRequest(`/barcodes/print-logs${suffix ? `?${suffix}` : ""}`);
}

export function generateProductBarcode(productId: string): Promise<BarcodeCatalogItem> {
  return apiRequest(`/barcodes/products/${productId}`, { method: "POST" });
}

export function generateMissingBarcodes(): Promise<GenerateMissingBarcodesResult> {
  return apiRequest("/barcodes/missing", { method: "POST" });
}

export function printBarcodes(payload: { productIds: string[]; copies: number }): Promise<PrintBarcodesResult> {
  return apiRequest("/barcodes/print", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
