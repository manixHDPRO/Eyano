import type { ReactNode } from "react";

type AlertTone = "error" | "success" | "info";

type AlertProps = {
  tone: AlertTone;
  children: ReactNode;
  role?: "alert" | "status";
};

const toneClasses: Record<AlertTone, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

export function Alert({ tone, children, role = tone === "error" ? "alert" : "status" }: AlertProps) {
  return (
    <p className={`rounded-lg border px-4 py-3 text-xs ${toneClasses[tone]}`} role={role}>
      {children}
    </p>
  );
}