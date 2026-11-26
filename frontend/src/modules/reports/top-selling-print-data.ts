import type { ReportsTopProductsResult } from "../../lib/api/reports";

export type TopSellingPrintPayload = {
  generatedAt: string;
  periodLabel: string;
  report: ReportsTopProductsResult;
};

export function buildTopSellingPrintPayload(
  report: ReportsTopProductsResult,
  periodLabel: string,
): TopSellingPrintPayload {
  return {
    generatedAt: new Date().toISOString(),
    periodLabel,
    report,
  };
}