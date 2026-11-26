import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-mono uppercase tracking-wider text-slate-500">{eyebrow}</p>
        ) : null}
        <h1
          className={`font-bold tracking-tight text-slate-900 font-display ${eyebrow ? "mt-1 text-2xl" : "text-2xl"}`}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}