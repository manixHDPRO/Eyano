import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { EyanoLogo } from "../EyanoLogo";
import type { AdminNavGroup } from "../../lib/navigation/admin-nav";
import { groupContainsPath, isItemActive } from "../../lib/navigation/admin-nav-accordion";
import { AdminNavGroupIcon } from "./AdminNavIcons";
import { AdminNavItemLink } from "./AdminNavItemLink";

type MenuVariantProps = {
  groups: AdminNavGroup[];
  onNavigate?: () => void;
};

export function AdminRailNav({ groups, onNavigate }: MenuVariantProps) {
  const { pathname } = useLocation();
  const pathGroup = groups.find((group) => groupContainsPath(group, pathname));
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const selectedId = pinnedId ?? pathGroup?.id ?? groups[0]?.id ?? null;
  const selected = groups.find((group) => group.id === selectedId) ?? null;

  useEffect(() => {
    setPinnedId(null);
  }, [pathname]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1 overflow-y-auto px-1.5 py-3">
        {groups.map((group) => {
          const active = group.id === selectedId;
          const only = group.items.length === 1 ? group.items[0] : null;
          const className = `flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] leading-tight font-medium ${
            active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`;
          const inner = (
            <>
              <AdminNavGroupIcon groupId={group.id} active={active} />
              <span className="line-clamp-2 text-center">{group.label}</span>
            </>
          );
          if (only) {
            return (
              <Link key={group.id} to={only.to} onClick={onNavigate} className={className} title={group.label}>
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={group.id}
              type="button"
              className={className}
              aria-pressed={active}
              onClick={() => setPinnedId(group.id)}
            >
              {inner}
            </button>
          );
        })}
      </div>
      {selected && selected.items.length > 1 ? (
        <div className="flex w-52 min-h-0 flex-col border-l border-slate-200 py-4 pr-3 pl-3">
          <p className="px-1.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
            {selected.label}
          </p>
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {selected.items.map((item) => (
              <AdminNavItemLink key={item.id} item={item} onNavigate={onNavigate} nested />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminTopNav({ groups }: { groups: AdminNavGroup[] }) {
  const { pathname } = useLocation();
  const pathGroup = groups.find((group) => groupContainsPath(group, pathname));
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const selectedId = pinnedId ?? pathGroup?.id ?? groups[0]?.id ?? null;
  const selected = groups.find((group) => group.id === selectedId) ?? null;

  useEffect(() => {
    setPinnedId(null);
  }, [pathname]);

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex gap-1 overflow-x-auto px-4 py-2 lg:px-8">
        {groups.map((group) => {
          const active = group.id === selectedId;
          const only = group.items.length === 1 ? group.items[0] : null;
          const className = `shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`;
          if (only) {
            return (
              <Link key={group.id} to={only.to} className={className}>
                {group.label}
              </Link>
            );
          }
          return (
            <button key={group.id} type="button" className={className} aria-pressed={active} onClick={() => setPinnedId(group.id)}>
              {group.label}
            </button>
          );
        })}
      </div>
      {selected && selected.items.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:px-8">
          {selected.items.map((item) => {
            const active = isItemActive(item, pathname);
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap ${
                  active ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AdminAtelierNav({ groups, onNavigate }: MenuVariantProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#000d30] px-4 py-5 text-white">
      <EyanoLogo tone="onDark" />
      <p className="mt-3 text-[11px] font-semibold tracking-[0.22em] text-[#fdba74] uppercase">Atelier</p>
      <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {groups.map((group, index) => (
          <div key={group.id}>
            <p className="mb-1 flex items-baseline gap-2 text-[10px] font-semibold tracking-[0.16em] text-[#fdba74] uppercase">
              <span className="font-mono">{String(index + 1).padStart(2, "0")}</span>
              {group.label}
            </p>
            <div className="flex flex-col">
              {group.items.map((item) => {
                const active = isItemActive(item, pathname);
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={onNavigate}
                    className={`border-l px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-[#f47a12] bg-white/10 font-semibold text-white"
                        : "border-white/15 text-slate-300 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
