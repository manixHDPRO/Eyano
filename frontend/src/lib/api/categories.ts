import { apiRequest } from "./client";
import type { CategoryDetail, CategoryLeafOption, CategoryTreeResponse } from "./types";

export function fetchCategoryTree(): Promise<CategoryTreeResponse> {
  return apiRequest("/categories");
}

export function fetchCategoryLeaves(): Promise<{ items: CategoryLeafOption[] }> {
  return apiRequest("/categories/leaves");
}

export function fetchCategory(id: string): Promise<CategoryDetail> {
  return apiRequest(`/categories/${id}`);
}

export type CategoryPayload = {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
  status?: string;
};

export function createCategory(payload: CategoryPayload): Promise<CategoryDetail> {
  return apiRequest("/categories", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCategory(id: string, payload: CategoryPayload): Promise<CategoryDetail> {
  return apiRequest(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function archiveCategory(id: string): Promise<CategoryDetail> {
  return apiRequest(`/categories/${id}/archive`, { method: "POST" });
}

export function restoreCategory(id: string): Promise<CategoryDetail> {
  return apiRequest(`/categories/${id}/restore`, { method: "POST" });
}

export function deleteCategory(id: string): Promise<void> {
  return apiRequest(`/categories/${id}`, { method: "DELETE", parseJson: false });
}
