import type { InventoryStatus } from "../../lib/api/types";
import { INVENTORY_PIPELINE, inventoryStatusLabel } from "./inventory-status";

type InventoryTimelineProps = {
  status: InventoryStatus;
};

function stepState(
  step: InventoryStatus,
  current: InventoryStatus,
): "done" | "current" | "upcoming" | "skipped" {
  if (current === "CANCELLED") {
    return step === "DRAFT" ? "done" : "skipped";
  }
  const currentIndex = INVENTORY_PIPELINE.indexOf(current);
  const stepIndex = INVENTORY_PIPELINE.indexOf(step);
  if (stepIndex < 0 || currentIndex < 0) {
    return "upcoming";
  }
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function InventoryTimeline({ status }: InventoryTimelineProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {INVENTORY_PIPELINE.map((step, index) => {
        const state = stepState(step, status);
        return (
          <li
            key={step}
            className={`relative overflow-hidden rounded-2xl border px-3 py-3 ${
              state === "current"
                ? "border-slate-300 bg-slate-100"
                : state === "done"
                  ? "border-emerald-400/20 bg-emerald-400/5"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {String(index + 1).padStart(2, "0")}
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                state === "current"
                  ? "text-slate-600"
                  : state === "done"
                    ? "text-emerald-200"
                    : state === "skipped"
                      ? "text-slate-600 line-through"
                      : "text-slate-400"
              }`}
            >
              {inventoryStatusLabel(step)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}