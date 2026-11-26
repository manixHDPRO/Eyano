export type ReportCatalogEntry = {
  id: string;
  navIconId?: string;
  title: string;
  description: string;
  to: string;
  permissions: string[];
  category: "commercial" | "stock" | "controle";
};

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    id: "sales",
    navIconId: "sales-supervision",
    title: "Historique des ventes",
    description: "Journal des tickets, statuts et montants par boutique.",
    to: "/admin/sales",
    permissions: ["reports.read", "sales.void", "sales.create"],
    category: "commercial",
  },
  {
    id: "cash-sessions",
    title: "Sessions de caisse",
    description: "Fonds d’ouverture, encaissements, dépenses et écarts de clôture.",
    to: "/admin/cash-sessions",
    permissions: ["cash.session", "reports.read"],
    category: "commercial",
  },
  {
    id: "payments",
    title: "Encaissements",
    description: "Lignes de paiement figées avec taux snapshot (USD / CDF).",
    to: "/admin/payments",
    permissions: ["reports.read", "sales.void", "sales.create"],
    category: "commercial",
  },
  {
    id: "expenses",
    title: "Dépenses",
    description: "Charges boutique et entrepôt, impact caisse et justificatifs.",
    to: "/admin/expenses",
    permissions: ["expenses.manage", "reports.read"],
    category: "commercial",
  },
  {
    id: "exchange-rates",
    title: "Taux de change",
    description: "Historique encaissement / décaissement et révisions.",
    to: "/admin/exchange-rates",
    permissions: ["exchange_rates.update", "reports.read"],
    category: "commercial",
  },
  {
    id: "stock",
    navIconId: "stock-levels",
    title: "Niveaux de stock",
    description: "Quantités, alertes et valorisation par site.",
    to: "/admin/stock",
    permissions: ["stock.read"],
    category: "stock",
  },
  {
    id: "central-warehouse",
    title: "Entrepôt central",
    description: "Réceptions fournisseur et tableau de bord entrepôt.",
    to: "/admin/central-warehouse",
    permissions: ["stock.read", "receipts.validate", "suppliers.manage", "suppliers.read"],
    category: "stock",
  },
  {
    id: "transfers",
    title: "Transferts",
    description: "Flux entrepôt → boutiques, statuts et écarts de réception.",
    to: "/admin/transfers",
    permissions: ["transfers.create", "transfers.validate", "transfers.prepare_ship", "transfers.receive"],
    category: "stock",
  },
  {
    id: "inventories",
    title: "Inventaires",
    description: "Sessions de comptage et écarts validés.",
    to: "/admin/inventories",
    permissions: ["inventory.conduct", "inventory.validate"],
    category: "stock",
  },
  {
    id: "internal-issues",
    title: "Sorties internes",
    description: "Consommation, maintenance et motifs traçables.",
    to: "/admin/internal-issues",
    permissions: ["internal_issues.request", "internal_issues.validate"],
    category: "stock",
  },
  {
    id: "audit",
    title: "Journal d’audit",
    description: "Piste append-only des actions sensibles.",
    to: "/admin/audit",
    permissions: ["audit.read"],
    category: "controle",
  },
  {
    id: "login-history",
    title: "Historique de connexion",
    description: "Réussites et échecs d’authentification.",
    to: "/admin/login-history",
    permissions: ["audit.read"],
    category: "controle",
  },
];

export const REPORT_CATEGORY_LABELS: Record<ReportCatalogEntry["category"], string> = {
  commercial: "Ventes & finance",
  stock: "Stock & logistique",
  controle: "Contrôle & conformité",
};