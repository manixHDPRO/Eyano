type StatusBadgeProps = {
  label: string;
  tone: "success" | "warning" | "neutral" | "muted" | "info" | "danger";
  compact?: boolean;
};

const toneClasses: Record<StatusBadgeProps["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  muted: "border-slate-200 bg-slate-50 text-slate-500",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  danger: "border-red-200 bg-red-50 text-red-700",
};

export function StatusBadge({ label, tone, compact = false }: StatusBadgeProps) {
  const sizeClass = compact ? "px-2 py-0.5 text-[10px] leading-tight" : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}