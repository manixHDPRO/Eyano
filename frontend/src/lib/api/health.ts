import { apiRequest } from "./client";
import type { HealthResponse } from "./types";

export function fetchHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}