import type { ReactNode } from "react";

type PlaceholderPanelProps = {
  title: string;
  description: string;
  badge?: string;
  children?: ReactNode;
};

export function PlaceholderPanel({ title, description, badge, children }: PlaceholderPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 font-display">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        </div>
        {badge ? (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {badge}
          </span>
        ) : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}