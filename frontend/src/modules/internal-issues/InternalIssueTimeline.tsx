import type { InternalIssueStatus } from "../../lib/api/types";
import { INTERNAL_ISSUE_PIPELINE, internalIssueStatusLabel } from "./internal-issue-status";

type InternalIssueTimelineProps = {
  status: InternalIssueStatus;
};

function stepState(
  step: InternalIssueStatus,
  current: InternalIssueStatus,
): "done" | "current" | "upcoming" | "skipped" {
  if (current === "CANCELLED" || current === "REJECTED") {
    if (step === "DRAFT") return "done";
    if (current === "REJECTED" && step === "PENDING") return "skipped";
    return "skipped";
  }
  const currentIndex = INTERNAL_ISSUE_PIPELINE.indexOf(current);
  const stepIndex = INTERNAL_ISSUE_PIPELINE.indexOf(step);
  if (stepIndex < 0 || currentIndex < 0) {
    return "upcoming";
  }
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function InternalIssueTimeline({ status }: InternalIssueTimelineProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {INTERNAL_ISSUE_PIPELINE.map((step, index) => {
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
              {internalIssueStatusLabel(step)}
            </p>
            {step === "PENDING" && status === "REJECTED" ? (
              <p className="mt-1 text-xs text-rose-300">Rejetée avant approbation</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}