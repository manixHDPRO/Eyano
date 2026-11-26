import type { ReactNode } from "react";

export type UsersHubTab = "accounts" | "roles" | "permissions";

type TabDef = { id: UsersHubTab; label: string; icon: ReactNode };

function tabClass(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
    active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
  }`;
}

function UsersTabIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 19v-.5A4.5 4.5 0 0 1 8.5 14H9.5A4.5 4.5 0 0 1 14 18.5V19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RolesTabIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 4 7v6c0 5 3.5 8 8 8s8-3 8-8V7l-8-4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PermissionsTabIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 5h11M9 12h11M9 19h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5 5h.01M5 12h.01M5 19h.01"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

type UsersInnerTabsProps = {
  active: UsersHubTab;
  onChange: (tab: UsersHubTab) => void;
  showRoles: boolean;
};

export function UsersInnerTabs({ active, onChange, showRoles }: UsersInnerTabsProps) {
  const tabs: TabDef[] = [
    { id: "accounts", label: "Comptes", icon: <UsersTabIcon /> },
    ...(showRoles
      ? [
          { id: "roles" as const, label: "Rôles", icon: <RolesTabIcon /> },
          { id: "permissions" as const, label: "Permissions", icon: <PermissionsTabIcon /> },
        ]
      : []),
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
      role="tablist"
      aria-label="Utilisateurs et rôles"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={tabClass(active === tab.id)}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}