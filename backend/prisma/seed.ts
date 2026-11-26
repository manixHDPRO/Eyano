import "dotenv/config";
import {
  DocumentSequenceCode,
  ExchangeRateType,
  Prisma,
  PrismaClient,
  SettingValueType,
} from "@prisma/client";
import { hashPassword } from "../src/common/crypto/argon2";

const prisma = new PrismaClient();

const PERMISSIONS: { code: string; module: string; description: string }[] = [
  { code: "users.manage", module: "users", description: "Créer, modifier et désactiver les utilisateurs" },
  { code: "roles.manage", module: "roles", description: "Gérer les rôles et leurs permissions" },
  { code: "stores.manage", module: "stores", description: "Gérer les boutiques" },
  { code: "stores.delete", module: "stores", description: "Supprimer définitivement les boutiques" },
  { code: "products.manage", module: "products", description: "Créer et modifier le catalogue" },
  { code: "products.read", module: "products", description: "Lire le catalogue" },
  { code: "prices.update", module: "pricing", description: "Modifier les prix officiels" },
  { code: "discounts.update", module: "discounts", description: "Modifier les remises" },
  { code: "barcodes.print", module: "barcodes", description: "Imprimer les codes-barres" },
  { code: "suppliers.manage", module: "suppliers", description: "Gérer les fournisseurs" },
  { code: "suppliers.read", module: "suppliers", description: "Lire les fournisseurs" },
  { code: "receipts.validate", module: "suppliers", description: "Valider une réception fournisseur" },
  { code: "stock.read", module: "stock", description: "Lire les soldes et mouvements" },
  { code: "stock.adjust", module: "stock", description: "Ajuster le stock manuellement" },
  { code: "transfers.create", module: "transfers", description: "Créer un transfert" },
  { code: "transfers.validate", module: "transfers", description: "Valider un transfert" },
  { code: "transfers.prepare_ship", module: "transfers", description: "Préparer et expédier un transfert" },
  { code: "transfers.receive", module: "transfers", description: "Réceptionner un transfert" },
  { code: "inventory.conduct", module: "inventory", description: "Conduire un inventaire" },
  { code: "inventory.validate", module: "inventory", description: "Valider un inventaire" },
  { code: "internal_issues.request", module: "internal-issues", description: "Demander une sortie interne" },
  { code: "internal_issues.validate", module: "internal-issues", description: "Approuver une sortie interne" },
  { code: "sales.create", module: "sales", description: "Enregistrer une vente" },
  { code: "sales.void", module: "sales", description: "Annuler une vente" },
  { code: "cash.session", module: "cash", description: "Ouvrir et clôturer une session de caisse" },
  { code: "expenses.manage", module: "expenses", description: "Saisir et gérer les dépenses" },
  { code: "exchange_rates.update", module: "finance", description: "Modifier les taux de change" },
  { code: "reports.read", module: "reports", description: "Consulter les rapports" },
  { code: "settings.update", module: "settings", description: "Modifier les paramètres non critiques" },
  { code: "settings.update_critical", module: "settings", description: "Modifier les paramètres critiques" },
  { code: "audit.read", module: "audit", description: "Lire le journal d'audit" },
];

const ROLES: { code: string; name: string; description: string; permissions: string[] }[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super administrateur",
    description: "Accès intégral, y compris paramètres critiques",
    permissions: PERMISSIONS.map((p) => p.code),
  },
  {
    code: "CENTRAL_ADMIN",
    name: "Administrateur central",
    description: "Pilotage général de l'exploitation",
    permissions: [
      "users.manage",
      "stores.manage",
      "products.manage",
      "products.read",
      "prices.update",
      "discounts.update",
      "barcodes.print",
      "suppliers.manage",
      "suppliers.read",
      "receipts.validate",
      "stock.read",
      "stock.adjust",
      "transfers.create",
      "transfers.validate",
      "transfers.prepare_ship",
      "transfers.receive",
      "inventory.conduct",
      "inventory.validate",
      "internal_issues.request",
      "internal_issues.validate",
      "sales.create",
      "sales.void",
      "cash.session",
      "expenses.manage",
      "exchange_rates.update",
      "reports.read",
      "settings.update",
      "audit.read",
    ],
  },
  {
    code: "ADMIN_STAFF",
    name: "Personnel administratif",
    description: "Opérations courantes accordées par le seed",
    permissions: [
      "products.read",
      "barcodes.print",
      "suppliers.read",
      "stock.read",
      "transfers.create",
      "transfers.receive",
      "inventory.conduct",
      "internal_issues.request",
      "expenses.manage",
      "reports.read",
    ],
  },
  {
    code: "WAREHOUSE_MANAGER",
    name: "Gestionnaire d'entrepôt",
    description: "Réceptions et mouvements de stock entrepôt",
    permissions: [
      "products.read",
      "barcodes.print",
      "suppliers.manage",
      "suppliers.read",
      "receipts.validate",
      "stock.read",
      "transfers.prepare_ship",
      "inventory.conduct",
      "internal_issues.request",
      "expenses.manage",
    ],
  },
  {
    code: "CASHIER",
    name: "Caissier",
    description: "Vente, session de caisse de sa boutique (confirmation des sorties tiroir saisies par l’administration)",
    permissions: ["products.read", "stock.read", "sales.create", "cash.session", "reports.read", "transfers.receive"],
  },
  {
    code: "ACCOUNTANT",
    name: "Comptable",
    description: "Lecture et suivi financier",
    permissions: [
      "products.read",
      "suppliers.read",
      "stock.read",
      "expenses.manage",
      "reports.read",
      "audit.read",
    ],
  },
];

const SEQUENCES: { code: DocumentSequenceCode; prefix: string; padding: number }[] = [
  { code: DocumentSequenceCode.SALE, prefix: "VE", padding: 6 },
  { code: DocumentSequenceCode.TRANSFER, prefix: "TR", padding: 6 },
  { code: DocumentSequenceCode.RECEIPT, prefix: "RC", padding: 6 },
  { code: DocumentSequenceCode.EXPENSE, prefix: "DP", padding: 6 },
  { code: DocumentSequenceCode.INVENTORY, prefix: "INV", padding: 6 },
  { code: DocumentSequenceCode.INTERNAL_ISSUE, prefix: "SI", padding: 6 },
];

type SettingSeed = {
  key: string;
  group: string;
  value: unknown;
  valueType: SettingValueType;
  isCritical: boolean;
  description: string;
};

const SETTINGS: SettingSeed[] = [
  { key: "commercial.primary_currency", group: "commercial", value: "USD", valueType: SettingValueType.STRING, isCritical: true, description: "Devise du catalogue" },
  { key: "commercial.accepted_currencies", group: "commercial", value: ["USD", "CDF"], valueType: SettingValueType.JSON, isCritical: true, description: "Devises d'encaissement" },
  { key: "commercial.rounding_mode", group: "commercial", value: "HALF_UP", valueType: SettingValueType.STRING, isCritical: true, description: "Mode d'arrondi" },
  { key: "commercial.rounding_scale_usd", group: "commercial", value: 2, valueType: SettingValueType.NUMBER, isCritical: true, description: "Décimales USD" },
  { key: "commercial.rounding_scale_cdf", group: "commercial", value: 0, valueType: SettingValueType.NUMBER, isCritical: true, description: "Décimales CDF" },
  {
    key: "commercial.payment_methods",
    group: "commercial",
    value: ["CASH", "MPESA", "ORANGE_MONEY", "AIRTEL_MONEY"],
    valueType: SettingValueType.JSON,
    isCritical: false,
    description: "Moyens de paiement",
  },
  {
    key: "commercial.receipt",
    group: "commercial",
    value: { header: "", footer: "", width_mm: 80, legal_notice: "" },
    valueType: SettingValueType.JSON,
    isCritical: false,
    description: "Mise en page ticket 80 mm",
  },
  { key: "stock.alert_threshold_default", group: "stock", value: 100, valueType: SettingValueType.NUMBER, isCritical: false, description: "Seuil d'alerte par défaut" },
  { key: "stock.block_when_insufficient", group: "stock", value: true, valueType: SettingValueType.BOOLEAN, isCritical: true, description: "Invariant : vente refusée si stock insuffisant" },
  { key: "stock.transfer_requires_validation", group: "stock", value: true, valueType: SettingValueType.BOOLEAN, isCritical: true, description: "Transfert soumis à validation" },
  { key: "stock.internal_issue_requires_approval", group: "stock", value: true, valueType: SettingValueType.BOOLEAN, isCritical: true, description: "Sortie interne soumise à approbation" },
  { key: "stock.internal_issue_requires_store_confirmation", group: "stock", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Confirmation boutique en caisse avant validation centrale" },
  { key: "stock.inventory_requires_justification", group: "stock", value: true, valueType: SettingValueType.BOOLEAN, isCritical: true, description: "Écart d'inventaire justifié" },
  { key: "stock.allow_manual_adjustment", group: "stock", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Ajustement manuel pour stock.adjust" },
  { key: "security.password_min_length", group: "security", value: 10, valueType: SettingValueType.NUMBER, isCritical: false, description: "Longueur minimale du mot de passe" },
  { key: "security.password_requires_mixed", group: "security", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Mot de passe mixte exigé" },
  { key: "security.session_access_ttl_min", group: "security", value: 15, valueType: SettingValueType.NUMBER, isCritical: false, description: "TTL du jeton d'accès (minutes)" },
  { key: "security.session_refresh_ttl_hours", group: "security", value: 12, valueType: SettingValueType.NUMBER, isCritical: false, description: "TTL du refresh (heures)" },
  { key: "security.max_failed_logins", group: "security", value: 5, valueType: SettingValueType.NUMBER, isCritical: false, description: "Échecs avant verrouillage" },
  { key: "security.lock_minutes", group: "security", value: 15, valueType: SettingValueType.NUMBER, isCritical: false, description: "Durée de verrouillage" },
  { key: "cash.force_close_after_hours", group: "cash", value: 16, valueType: SettingValueType.NUMBER, isCritical: false, description: "Clôture quotidienne conseillée (heures)" },
  { key: "notifications.LOW_STOCK", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification seuil" },
  { key: "notifications.STOCKOUT", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification rupture" },
  { key: "notifications.TRANSFER_PENDING", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification transfert en attente" },
  { key: "notifications.TRANSFER_SHIPPED", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Alerte caisse : transfert expédié à réceptionner" },
  { key: "notifications.TRANSFER_RECEIVED", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification transfert réceptionné" },
  { key: "notifications.INVENTORY_VARIANCE", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification écart d'inventaire" },
  { key: "notifications.CASH_VARIANCE", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification écart de caisse" },
  { key: "notifications.INTERNAL_ISSUE_PENDING", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification sortie interne à valider" },
  {
    key: "notifications.EXPENSE_DRAWER_PENDING",
    group: "notifications",
    value: true,
    valueType: SettingValueType.BOOLEAN,
    isCritical: false,
    description: "Notification dépense tiroir en attente de confirmation caissière",
  },
  { key: "notifications.PRICE_CHANGED", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification modification de prix" },
  { key: "notifications.DISCOUNT_CHANGED", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification modification de remise" },
  { key: "notifications.RATE_CHANGED", group: "notifications", value: true, valueType: SettingValueType.BOOLEAN, isCritical: false, description: "Notification modification de taux" },
  { key: "company.legal_name", group: "technical", value: "Eyano", valueType: SettingValueType.STRING, isCritical: false, description: "Raison sociale" },
  { key: "company.timezone", group: "technical", value: "Africa/Kinshasa", valueType: SettingValueType.STRING, isCritical: false, description: "Fuseau d'affichage" },
  { key: "company.date_format", group: "technical", value: "dd/MM/yyyy", valueType: SettingValueType.STRING, isCritical: false, description: "Format de date d'affichage" },
  { key: "company.address", group: "technical", value: "", valueType: SettingValueType.STRING, isCritical: false, description: "Adresse de l'établissement" },
  { key: "company.phone", group: "technical", value: "", valueType: SettingValueType.STRING, isCritical: false, description: "Téléphone de l'établissement" },
  { key: "company.logo_path", group: "technical", value: null, valueType: SettingValueType.STRING, isCritical: false, description: "Chemin du logo" },
];

async function seedRolesAndPermissions(): Promise<Map<string, string>> {
  const permissionIds = new Map<string, string>();
  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
    permissionIds.set(permission.code, row.id);
  }

  const roleIds = new Map<string, string>();
  for (const role of ROLES) {
    const row = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, isSystem: true },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
    roleIds.set(role.code, row.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: row.id } });
    await prisma.rolePermission.createMany({
      data: role.permissions.map((code) => {
        const permissionId = permissionIds.get(code);
        if (!permissionId) {
          throw new Error(`Permission inconnue dans le seed du rôle ${role.code}: ${code}`);
        }
        return { roleId: row.id, permissionId };
      }),
    });
  }

  return roleIds;
}

async function seedSuperAdmin(roleIds: Map<string, string>): Promise<string> {
  const roleId = roleIds.get("SUPER_ADMIN");
  if (!roleId) {
    throw new Error("Rôle SUPER_ADMIN absent après seed");
  }

  const email = process.env.SEED_SUPERADMIN_EMAIL ?? "admin@eyano.local";
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe_Eyano_Local1";
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        roleId,
        firstName: "Super",
        lastName: "Admin",
        status: "ACTIVE",
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      status: "ACTIVE",
      roleId,
      passwordChangedAt: new Date(),
    },
  });
  return created.id;
}

async function seedWarehouse(): Promise<void> {
  await prisma.warehouse.upsert({
    where: { code: "CENTRAL" },
    update: { name: "Entrepôt central", status: "ACTIVE" },
    create: {
      code: "CENTRAL",
      name: "Entrepôt central",
      status: "ACTIVE",
    },
  });
}

async function seedRates(adminId: string): Promise<void> {
  const seeds = [
    { rateType: ExchangeRateType.ENCAISSEMENT, rate: "24000" },
    { rateType: ExchangeRateType.DECAISSEMENT, rate: "22500" },
  ] as const;

  for (const seed of seeds) {
    const open = await prisma.exchangeRate.findFirst({
      where: { rateType: seed.rateType, validTo: null },
    });
    if (open) {
      continue;
    }
    await prisma.exchangeRate.create({
      data: {
        rateType: seed.rateType,
        baseCurrency: "USD",
        quoteCurrency: "CDF",
        rate: seed.rate,
        validFrom: new Date(),
        createdById: adminId,
      },
    });
  }
}

async function seedSettings(): Promise<void> {
  for (const setting of SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {
        group: setting.group,
        value: setting.value as Prisma.InputJsonValue,
        valueType: setting.valueType,
        isCritical: setting.isCritical,
        description: setting.description,
      },
      create: {
        key: setting.key,
        group: setting.group,
        value: setting.value as Prisma.InputJsonValue,
        valueType: setting.valueType,
        isCritical: setting.isCritical,
        description: setting.description,
      },
    });
  }
}

async function seedSequences(): Promise<void> {
  for (const sequence of SEQUENCES) {
    await prisma.documentSequence.upsert({
      where: { code: sequence.code },
      update: { prefix: sequence.prefix, padding: sequence.padding },
      create: {
        code: sequence.code,
        prefix: sequence.prefix,
        padding: sequence.padding,
        nextNumber: 1,
      },
    });
  }
}

async function main(): Promise<void> {
  const roleIds = await seedRolesAndPermissions();
  const adminId = await seedSuperAdmin(roleIds);
  await seedWarehouse();
  await seedRates(adminId);
  await seedSettings();
  await seedSequences();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
