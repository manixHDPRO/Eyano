import type { TransferStatus } from "../../lib/api/types";
import { TRANSFER_PIPELINE, transferStatusLabel } from "./transfer-status";

type TransferTimelineProps = {
  status: TransferStatus;
};

function stepState(
  step: TransferStatus,
  current: TransferStatus,
): "done" | "current" | "upcoming" | "skipped" {
  if (current === "CANCELLED") {
    return step === "DRAFT" ? "done" : "skipped";
  }
  if (current === "RECEIVED" && step === "RECEIVED") {
    return "done";
  }
  if (current === "RECEIVED" && step === "PARTIALLY_RECEIVED") {
    return "skipped";
  }
  if (current === "SHIPPED" && step === "PARTIALLY_RECEIVED") {
    return "upcoming";
  }
  const currentIndex = TRANSFER_PIPELINE.indexOf(current);
  const stepIndex = TRANSFER_PIPELINE.indexOf(step);
  if (stepIndex < 0 || currentIndex < 0) {
    return "upcoming";
  }
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function TransferTimeline({ status }: TransferTimelineProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {TRANSFER_PIPELINE.map((step, index) => {
        const state = stepState(step, status);
        const isPartialOptional = step === "PARTIALLY_RECEIVED";
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
              {isPartialOptional ? " · optionnel" : ""}
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                state === "current"
                  ? "text-slate-600"
                  : state === "done"
                    ? "text-emerald-200"
                    : "text-slate-400"
              }`}
            >
              {transferStatusLabel(step)}
            </p>
            {state === "current" ? (
              <span className="mt-2 inline-flex rounded-full bg-slate-900/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                Étape en cours
              </span>
            ) : status === "RECEIVED" && step === "RECEIVED" && state === "done" ? (
              <span className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                Terminé
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
