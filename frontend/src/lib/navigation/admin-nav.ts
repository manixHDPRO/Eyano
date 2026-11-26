/**
 * Menu administration aligné sur ARCHITECTURE.md et import-hd-eyano-app.
 * « Administration » : entrée de barre latérale + sous-onglets dans la page (AdminSettingsView).
 */
export type AdminNavItem = {
  id: string;
  label: string;
  to: string;
  end?: boolean;
  permissions: readonly string[];
  implemented: boolean;
  palier?: string;
  description?: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export type AdminSettingsSection = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_SETTINGS_SECTIONS: AdminSettingsSection[] = [
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        id: "presentation",
        label: "Présentation",
        to: "/admin/presentation",
        permissions: [],
        implemented: true,
        description: "Choix du menu et du tableau de bord.",
      },
      {
        id: "stores",
        label: "Boutiques",
        to: "/admin/stores",
        permissions: ["stores.manage"],
        implemented: true,
        palier: "7",
        description: "Fiches boutiques, ticket et caisses.",
      },
      {
        id: "warehouse",
        label: "Entrepôt",
        to: "/admin/warehouse",
        permissions: ["stores.manage", "stock.read"],
        implemented: true,
        palier: "7",
        description: "Fiche référentielle du nœud logistique (code CENTRAL).",
      },
      {
        id: "users",
        label: "Utilisateurs & Rôles",
        to: "/admin/users",
        permissions: ["users.manage", "roles.manage"],
        implemented: true,
        palier: "5",
        description: "Comptes, rôles et affectation aux boutiques.",
      },
      {
        id: "settings-app",
        label: "Paramètres",
        to: "/admin/settings",
        permissions: ["settings.update", "settings.update_critical"],
        implemented: true,
        palier: "20",
        description: "Paramètres commerciaux, stock, sécurité et techniques.",
      },
      {
        id: "notifications",
        label: "Notifications",
        to: "/admin/notifications",
        permissions: [
          "stock.read",
          "reports.read",
          "transfers.receive",
          "transfers.create",
          "transfers.validate",
        ],
        implemented: true,
        description: "Centre de notifications — stock, transferts, caisse et paramètres métier.",
      },
      {
        id: "audit",
        label: "Journal d’audit",
        to: "/admin/audit",
        permissions: ["audit.read"],
        implemented: true,
        palier: "20",
        description: "Traçabilité append-only : auteur, action, ancienne et nouvelle valeur.",
      },
      {
        id: "login-history",
        label: "Historique des connexions",
        to: "/admin/login-history",
        permissions: ["audit.read"],
        implemented: true,
        palier: "20",
        description: "Journal des tentatives de login : IP, client, succès et échecs.",
      },
    ],
  },
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Vue d’ensemble",
    items: [
      {
        id: "dashboard",
        label: "Tableau de bord",
        to: "/admin",
        end: true,
        permissions: [],
        implemented: true,
        description: "Vue consolidée multi-boutiques, KPI, graphiques et alertes stock.",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalogue",
    items: [
      {
        id: "products",
        label: "Produits",
        to: "/admin/products",
        permissions: ["products.manage", "products.read"],
        implemented: true,
        palier: "8",
        description: "Catalogue central, seuils d’alerte et affectation boutiques.",
      },
      {
        id: "categories",
        label: "Catégories",
        to: "/admin/categories",
        permissions: ["products.manage"],
        implemented: true,
        palier: "8",
        description: "Arbre à deux niveaux ; les produits se classent sur une feuille.",
      },
      {
        id: "barcodes",
        label: "Codes-barres",
        to: "/admin/barcodes",
        permissions: ["barcodes.print", "products.manage"],
        implemented: true,
        palier: "10",
        description: "Code 128 unique, impression unitaire ou lot, journal.",
      },
      {
        id: "pricing",
        label: "Prix & remises",
        to: "/admin/pricing",
        permissions: ["prices.update", "discounts.update", "products.read", "products.manage"],
        implemented: true,
        palier: "9",
      },
    ],
  },
  {
    id: "stock",
    label: "Stocks",
    items: [
      {
        id: "central-warehouse",
        label: "Entrepôt central",
        to: "/admin/central-warehouse",
        permissions: ["stock.read", "receipts.validate", "suppliers.manage", "suppliers.read"],
        implemented: true,
        palier: "11",
        description: "Tableau de bord entrepôt, réceptions fournisseur et ajustements autorisés.",
      },
      {
        id: "suppliers",
        label: "Fournisseurs",
        to: "/admin/suppliers",
        permissions: ["suppliers.manage", "suppliers.read"],
        implemented: true,
        palier: "11",
        description: "Référentiel fournisseurs actifs pour les réceptions.",
      },
      {
        id: "stock-levels",
        label: "Soldes & mouvements",
        to: "/admin/stock",
        permissions: ["stock.read"],
        implemented: true,
        palier: "12",
        description:
          "Soldes par lieu, historique des mouvements (grand livre), alertes seuil / rupture et réconciliation super admin.",
      },
      {
        id: "transfers",
        label: "Transferts",
        to: "/admin/transfers",
        permissions: ["transfers.create", "transfers.validate", "transfers.prepare_ship", "transfers.receive"],
        implemented: true,
        palier: "13",
        description:
          "Entrepôt → boutique : réservation, expédition, puis accusé de réception par la boutique (caissière) avec contrôle des écarts.",
      },
      {
        id: "inventories",
        label: "Inventaires",
        to: "/admin/inventories",
        permissions: ["inventory.conduct", "inventory.validate"],
        implemented: true,
        palier: "14",
        description:
          "Rapprochement théorique / physique par lieu, justification des écarts et ajustement INVENTORY_ADJUSTMENT à la validation.",
      },
      {
        id: "internal-issues",
        label: "Sorties internes",
        to: "/admin/internal-issues",
        permissions: ["internal_issues.request", "internal_issues.validate"],
        implemented: true,
        palier: "15",
        description:
          "Demande → approbation centrale : mouvement INTERNAL_ISSUE uniquement après validation, avec motifs traçables.",
      },
    ],
  },
  {
    id: "sales",
    label: "Ventes & caisse",
    items: [
      {
        id: "sales-supervision",
        label: "Historique des ventes",
        to: "/admin/sales",
        permissions: ["sales.void", "reports.read", "sales.create"],
        implemented: true,
        palier: "16",
        description: "Journal de toutes les ventes (toutes sessions), filtres boutique et statut.",
      },
      {
        id: "cash-sessions",
        label: "Sessions de caisse",
        to: "/admin/cash-sessions",
        permissions: ["cash.session", "reports.read"],
        implemented: true,
        palier: "16",
        description:
          "Situation de caisse par session (fond, encaissements, dépenses, solde) — même lecture qu’à la clôture POS.",
      },
      {
        id: "cash-registers",
        label: "Caisses",
        to: "/admin/cash-registers",
        permissions: ["stores.manage"],
        implemented: true,
        palier: "7",
        description: "Terminaux POS par boutique, caisse par défaut et lien avec les sessions.",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        id: "payments",
        label: "Encaissements",
        to: "/admin/payments",
        permissions: ["reports.read", "sales.void", "sales.create"],
        implemented: true,
        palier: "16",
        description:
          "Historique des lignes de paiement figées (USD/CDF, taux snapshot) avec lien vers chaque vente.",
      },
      {
        id: "expenses",
        label: "Dépenses",
        to: "/admin/expenses",
        permissions: ["expenses.manage", "reports.read"],
        implemented: true,
        palier: "17",
        description:
          "Journal des charges boutique / entrepôt (USD / CDF), justificatifs et impact sur le solde théorique caisse.",
      },
      {
        id: "exchange-rates",
        label: "Taux de change",
        to: "/admin/exchange-rates",
        permissions: ["exchange_rates.update", "reports.read"],
        implemented: true,
        palier: "17",
      },
    ],
  },
  {
    id: "reports-exports",
    label: "Rapport & Exports",
    items: [
      {
        id: "reports",
        label: "Rapport & Exports",
        to: "/admin/reports",
        permissions: ["reports.read"],
        implemented: true,
        palier: "19",
        description: "Rapports commerciaux, stock et financiers, exports PDF et Excel.",
      },
      {
        id: "reports-top-selling",
        label: "Top ventes boutique",
        to: "/admin/reports/top-selling",
        permissions: ["reports.read"],
        implemented: true,
        palier: "19",
        description: "Produits les plus vendus par quantité pour une boutique sélectionnée, avec impression.",
      },
    ],
  },
  {
    id: "system",
    label: "Système",
    items: [
      {
        id: "administration",
        label: "Administration",
        to: "/admin/administration",
        permissions: [
          "users.manage",
          "roles.manage",
          "stores.manage",
          "stock.read",
          "settings.update",
          "settings.update_critical",
          "audit.read",
          "reports.read",
        ],
        implemented: true,
        description: "Boutiques, entrepôt, identité, paramètres applicatifs, notifications et audit.",
      },
    ],
  },
];

const SETTINGS_NAV_ITEMS = ADMIN_SETTINGS_SECTIONS.flatMap((section) => section.items);
const MAIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
const ALL_NAV_ITEMS = [...MAIN_NAV_ITEMS, ...SETTINGS_NAV_ITEMS];

export const ALL_NAV_ITEMS_PREVIEW_LOOKUP = new Map(
  ALL_NAV_ITEMS.filter((item) => item.to.startsWith("/admin/preview/")).map((item) => {
    const slug = item.to.replace("/admin/preview/", "");
    return [slug, item] as const;
  }),
);

export function findNavItemById(id: string): AdminNavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.id === id);
}

export function findNavItemByPath(pathname: string): AdminNavItem | undefined {
  const exact = ALL_NAV_ITEMS.find((item) => {
    if (item.end) {
      return pathname === item.to;
    }
    if (item.implemented) {
      return pathname === item.to || pathname.startsWith(`${item.to}/`);
    }
    return pathname === item.to;
  });
  if (exact) {
    return exact;
  }
  const previewMatch = pathname.match(/^\/admin\/preview\/([^/]+)$/);
  if (previewMatch) {
    const slug = previewMatch[1];
    return ALL_NAV_ITEMS.find((item) => item.to === `/admin/preview/${slug}`);
  }
  return undefined;
}

export function listSettingsNavItems(): AdminNavItem[] {
  return SETTINGS_NAV_ITEMS;
}

export function listAdministrationNavItems(): AdminNavItem[] {
  return SETTINGS_NAV_ITEMS;
}

function pathMatchesNavItem(pathname: string, item: AdminNavItem): boolean {
  if (item.end) {
    return pathname === item.to;
  }
  if (item.implemented) {
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }
  return pathname === item.to;
}

/** En-tête + onglets : écrans du hub Administration (hors Rapport & Exports). */
export function isAdministrationSectionPath(pathname: string): boolean {
  return ADMIN_SETTINGS_SECTIONS.flatMap((section) => section.items).some((item) =>
    pathMatchesNavItem(pathname, item),
  );
}