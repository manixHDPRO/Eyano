import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { AdminNavGroup } from "../../lib/navigation/admin-nav";
import {
  findOpenGroupIdForPath,
  isItemActive,
  loadOpenGroupId,
  saveOpenGroupId,
} from "../../lib/navigation/admin-nav-accordion";
import { AdminNavGroupIcon } from "./AdminNavIcons";
import { AdminNavItemLink } from "./AdminNavItemLink";

type AdminSidebarNavProps = {
  groups: AdminNavGroup[];
  onNavigate?: () => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapsibleNavGroup({
  group,
  expanded,
  onToggle,
  onNavigate,
  pathname,
}: {
  group: AdminNavGroup;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  pathname: string;
}) {
  const activeInGroup = group.items.some((item) => isItemActive(item, pathname));

  if (group.items.length === 1) {
    if (group.id === "overview" || group.id === "system" || group.id === "reports-exports") {
      return <AdminNavItemLink item={group.items[0]!} onNavigate={onNavigate} />;
    }
    return (
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 px-1.5 pb-0 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
          <AdminNavGroupIcon groupId={group.id} active={activeInGroup} />
          <span>{group.label}</span>
        </p>
        <div className="ml-9 border-l border-slate-200 py-0.5 pl-2.5">
          <AdminNavItemLink item={group.items[0]!} onNavigate={onNavigate} nested />
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-transparent transition-colors has-[:focus-visible]:border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg px-1.5 py-1 text-left text-[10px] font-semibold uppercase tracking-widest transition-colors ${
          activeInGroup && !expanded ? "text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <AdminNavGroupIcon groupId={group.id} active={activeInGroup} />
          <span className="truncate">{group.label}</span>
          {activeInGroup ? (
            <span className="size-1.5 shrink-0 rounded-full bg-slate-900" aria-hidden />
          ) : null}
        </span>
        <Chevron open={expanded} />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 ml-8 flex flex-col gap-0 border-l border-slate-200 py-0 pl-2 pl-2.5 pb-0.5">
            {group.items.map((item) => (
              <AdminNavItemLink key={item.id} item={item} onNavigate={onNavigate} nested />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function resolveInitialOpenGroupId(groups: AdminNavGroup[], pathname: string): string | null {
  const stored = loadOpenGroupId();
  if (stored && groups.some((group) => group.id === stored && group.items.length > 1)) {
    return stored;
  }
  return findOpenGroupIdForPath(groups, pathname);
}

export function AdminSidebarNav({ groups, onNavigate }: AdminSidebarNavProps) {
  const { pathname } = useLocation();
  const [openGroupId, setOpenGroupId] = useState<string | null>(() => resolveInitialOpenGroupId(groups, pathname));

  useEffect(() => {
    const forPath = findOpenGroupIdForPath(groups, pathname);
    setOpenGroupId(forPath);
    saveOpenGroupId(forPath);
  }, [pathname, groups]);

  function toggleGroup(group: AdminNavGroup) {
    if (group.items.length <= 1) {
      return;
    }
    const next = openGroupId === group.id ? null : group.id;
    setOpenGroupId(next);
    saveOpenGroupId(next);
  }

  return (
    <nav className="mt-1 flex flex-col gap-0.5">
      {groups.map((group) => (
        <CollapsibleNavGroup
          key={group.id}
          group={group}
          expanded={group.items.length > 1 && openGroupId === group.id}
          pathname={pathname}
          onNavigate={onNavigate}
          onToggle={() => toggleGroup(group)}
        />
      ))}
    </nav>
  );
}