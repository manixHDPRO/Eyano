import { apiRequest } from "./client";
import type { PaginatedPricingOverview, ProductPricingTimeline } from "./types";

export function fetchPricingOverview(
  params: { page?: number; pageSize?: number; search?: string } = {},
): Promise<PaginatedPricingOverview> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search?.trim()) query.set("search", params.search.trim());
  const suffix = query.toString();
  return apiRequest(`/pricing/overview${suffix ? `?${suffix}` : ""}`);
}

export function fetchProductPricingTimeline(productId: string): Promise<ProductPricingTimeline> {
  return apiRequest(`/pricing/products/${productId}`);
}

export function updateProductPrices(
  productId: string,
  payload: { purchasePrice: number; officialPrice: number; reason?: string },
): Promise<ProductPricingTimeline> {
  return apiRequest(`/pricing/products/${productId}/prices`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateProductDiscount(
  productId: string,
  payload: { percent: number; reason?: string },
): Promise<ProductPricingTimeline> {
  return apiRequest(`/discounts/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}