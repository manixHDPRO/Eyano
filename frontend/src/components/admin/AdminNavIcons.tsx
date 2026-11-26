import type { ReactElement, ReactNode } from "react";

type IconProps = {
  className?: string;
};

function Svg({ children, className = "size-3.5 shrink-0" }: { children: ReactNode; className?: string }) {
  return (
    <svg className={`block ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

const icons: Record<string, (props: IconProps) => ReactElement> = {
  dashboard: () => (
    <Svg>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  ),
  users: () => (
    <Svg>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 19v-.5A4.5 4.5 0 0 1 8.5 14H9.5A4.5 4.5 0 0 1 14 18.5V19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 11v6M20 14h-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  roles: () => (
    <Svg>
      <path d="M12 3 4 7v6c0 5 3.5 8 8 8s8-3 8-8V7l-8-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  products: () => (
    <Svg>
      <path d="M8 7h8l2 4H6l2-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 11v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  categories: () => (
    <Svg>
      <path d="M4 6h6v6H4V6zM14 6h6v6h-6V6zM4 16h6v4H4v-4zM14 16h6v4h-6v-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  ),
  barcodes: () => (
    <Svg>
      <path d="M4 8V6M7 18V6M10 18v-4M13 18V8M16 18V6M20 18v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  pricing: () => (
    <Svg>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.5 9.5c.5-1 1.8-1.5 3-1 1.2.5 1.5 2 .2 2.8-1.4.9-3 .5-3.2 2.2H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  stores: () => (
    <Svg>
      <path d="M4 10 12 5l8 5v9H4v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 19v-5h4v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  ),
  "central-warehouse": () => (
    <Svg>
      <path d="M3 9l9-5 9 5v10H3V9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 19v-6h8v6" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  warehouse: () => (
    <Svg>
      <path d="M3 9l9-5 9 5v10H3V9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 19v-6h8v6" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  "cash-registers": () => (
    <Svg>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 12h5M8 16h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  suppliers: () => (
    <Svg>
      <path d="M3 16h13v4H3v-4zM16 8h5v12h-5V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 12h10M3 8h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  "stock-levels": () => (
    <Svg>
      <path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8V6a4 4 0 1 1 8 0v2" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  transfers: () => (
    <Svg>
      <path d="M7 7h11M14 4l4 3-4 3M17 17H6M10 20l-4-3 4-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  inventories: () => (
    <Svg>
      <path d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  ),
  "internal-issues": () => (
    <Svg>
      <path d="M12 3v12M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 19h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  "sales-supervision": () => (
    <Svg>
      <path d="M6 7h14l-1 12H7L6 7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 7V5a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  "cash-sessions": () => (
    <Svg>
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  payments: () => (
    <Svg>
      <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 11h18" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  expenses: () => (
    <Svg>
      <path d="M12 3v18M7 8l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  "exchange-rates": () => (
    <Svg>
      <path d="M7 10h10M7 14h10M10 7 7 10l3 3M17 17l3-3-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  reports: () => (
    <Svg>
      <path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  notifications: () => (
    <Svg>
      <path d="M12 4a4 4 0 0 0-4 4v3l-2 3h12l-2-3V8a4 4 0 0 0-4-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  settings: () => (
    <Svg>
      <path
        d="M11.1 2.6h1.8l.5 2a4.9 4.9 0 0 1 1.75.9l1.95-1.1 1.25 1.25-1.1 1.95c.47.54.85 1.16 1.1 1.8l2 .45v1.8l-2 .45a4.9 4.9 0 0 1-1.1 1.8l1.1 1.95-1.25 1.25-1.95-1.1a4.9 4.9 0 0 1-1.75.9l-.5 2h-1.8l-.5-2a4.9 4.9 0 0 1-1.75-.9l-1.95 1.1-1.25-1.25 1.1-1.95a4.9 4.9 0 0 1-1.1-1.8l-2-.45v-1.8l2-.45a4.9 4.9 0 0 1 1.1-1.8l-1.1-1.95 1.25-1.25 1.95 1.1c.55-.38 1.14-.68 1.75-.9l.5-2z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.65" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  "settings-app": () => (
    <Svg>
      <path
        d="M11.1 2.6h1.8l.5 2a4.9 4.9 0 0 1 1.75.9l1.95-1.1 1.25 1.25-1.1 1.95c.47.54.85 1.16 1.1 1.8l2 .45v1.8l-2 .45a4.9 4.9 0 0 1-1.1 1.8l1.1 1.95-1.25 1.25-1.95-1.1a4.9 4.9 0 0 1-1.75.9l-.5 2h-1.8l-.5-2a4.9 4.9 0 0 1-1.75-.9l-1.95 1.1-1.25-1.25 1.1-1.95a4.9 4.9 0 0 1-1.1-1.8l-2-.45v-1.8l2-.45a4.9 4.9 0 0 1 1.1-1.8l-1.1-1.95 1.25-1.25 1.95 1.1c.55-.38 1.14-.68 1.75-.9l.5-2z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.65" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  audit: () => (
    <Svg>
      <path d="M7 4h10v16H7V4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  "login-history": () => (
    <Svg>
      <path
        d="M12 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M5 19c1.4-2.8 3.4-4.2 7-4.2s5.6 1.4 7 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.5 7.5 20 5M17.5 5 20 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  overview: () => (
    <Svg>
      <path d="M4 5h6v6H4V5zM14 5h6v6h-6V5zM4 15h6v4H4v-4zM14 15h6v4h-6v-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  ),
  identity: () => (
    <Svg>
      <path d="M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19c1.2-3 3.5-4.5 7-4.5s5.8 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  catalog: () => (
    <Svg>
      <path d="M4 7.5 12 3l8 4.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  ),
  network: () => (
    <Svg>
      <path d="M3 11h7v9H3v-9zM14 4h7v16h-7V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  ),
  stock: () => (
    <Svg>
      <path d="M12 3 4 7v5c0 4.5 3.2 7.5 8 8 4.8-.5 8-3.5 8-8V7l-8-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  ),
  sales: () => (
    <Svg>
      <path d="M7 7h10l1 10H6L7 7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1" fill="currentColor" />
      <circle cx="17" cy="20" r="1" fill="currentColor" />
    </Svg>
  ),
  finance: () => (
    <Svg>
      <path d="M4 8h16v11H4V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  ),
  pilotage: () => (
    <Svg>
      <path d="M4 18 9 9l4 4 7-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  default: () => (
    <Svg>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
};

export function renderNavIcon(id: string, className = "inline-flex size-4 shrink-0 items-center justify-center leading-none") {
  const resolvedId =
    id === "administration" || id === "system"
      ? "settings"
      : id === "reports-exports"
        ? "reports"
        : id === "presentation"
          ? "overview"
          : id;
  const Icon = icons[resolvedId] ?? icons.default;
  return (
    <span className={className} aria-hidden>
      {Icon({})}
    </span>
  );
}

type NavIconBadgeProps = {
  navId: string;
  active?: boolean;
  size?: "sm" | "md";
};

export function NavIconBadge({ navId, active = false, size = "sm" }: NavIconBadgeProps) {
  const box = size === "md" ? "size-7" : "size-6";
  const tone = active
    ? "border-slate-900 bg-slate-900 text-white"
    : "border-slate-200 bg-slate-50 text-slate-500";

  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-lg border ${tone}`}>
      {renderNavIcon(navId)}
    </span>
  );
}

export function AdminNavItemIcon({ itemId, active }: { itemId: string; active?: boolean }) {
  return <NavIconBadge navId={itemId} active={active} />;
}

export function AdminNavGroupIcon({ groupId, active }: { groupId: string; active?: boolean }) {
  return <NavIconBadge navId={groupId} active={active} size="sm" />;
}