import { Link } from "react-router-dom";
import { AdminNavItemIcon } from "../../components/admin/AdminNavIcons";
import { hasPermission } from "../../lib/auth/permissions";
import type { AuthUser } from "../../lib/api/types";
import { REPORT_CATALOG, REPORT_CATEGORY_LABELS, type ReportCatalogEntry } from "./reports-catalog";

type ReportsCatalogSectionProps = {
  user: AuthUser;
};

export function ReportsCatalogSection({ user }: ReportsCatalogSectionProps) {
  const entries = REPORT_CATALOG.filter((entry) =>
    entry.permissions.some((code) => hasPermission(user, code)),
  );

  if (entries.length === 0) {
    return null;
  }

  const groups = groupByCategory(entries);

  return (
    <section className="space-y-6 print:hidden">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Accès aux journaux détaillés</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
          Chaque rapport métier reste disponible en lecture détaillée ; cette page regroupe les synthèses et les exports.
        </p>
      </div>
      <div className="space-y-8">
        {groups.map(([category, items]) => (
          <div key={category}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {REPORT_CATEGORY_LABELS[category]}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((entry) => (
                <Link
                  key={entry.id}
                  to={entry.to}
                  className="group flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white">
                    <AdminNavItemIcon itemId={entry.navIconId ?? entry.id} active={false} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{entry.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{entry.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function groupByCategory(entries: ReportCatalogEntry[]): Array<[ReportCatalogEntry["category"], ReportCatalogEntry[]]> {
  const order: ReportCatalogEntry["category"][] = ["commercial", "stock", "controle"];
  const map = new Map<ReportCatalogEntry["category"], ReportCatalogEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.category) ?? [];
    list.push(entry);
    map.set(entry.category, list);
  }
  return order.filter((key) => map.has(key)).map((key) => [key, map.get(key)!]);
}