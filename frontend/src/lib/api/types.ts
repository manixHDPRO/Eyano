export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type HealthResponse = {
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
  database: {
    status: "up" | "down";
    latencyMs?: number;
  };
};

export type UserStoreAssignment = {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  role: {
    id: string;
    code: string;
    name: string;
  };
  permissions: string[];
  stores: UserStoreAssignment[];
};

export type RoleSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
};

export type PermissionCatalogItem = {
  id: string;
  code: string;
  module: string;
  description: string | null;
};

export type RolePermissionItem = PermissionCatalogItem;

export type RoleDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: RolePermissionItem[];
};

export type UserListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  role: { id: string; code: string; name: string };
  storeCount: number;
  updatedAt: string;
};

export type UserDetail = UserListItem & {
  stores: UserStoreAssignment[];
  createdAt: string;
};

export type PaginatedUsers = {
  items: UserListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type StoreOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
};

export type ReferentialStatus = "ACTIVE" | "INACTIVE";

export type CashRegisterSummary = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  status: ReferentialStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoreListItem = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  status: ReferentialStatus;
  defaultCashRegister: { id: string; code: string; name: string } | null;
  cashRegisterCount: number;
  staffCount: number;
  updatedAt: string;
};

export type StoreDetail = StoreListItem & {
  receiptHeader: string | null;
  receiptFooter: string | null;
  cashRegisters: CashRegisterSummary[];
  createdAt: string;
};

export type PaginatedStores = {
  items: StoreListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: {
    active: number;
    inactive: number;
    cashRegisters: number;
  };
};

export type WarehouseDetail = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: ReferentialStatus;
  createdAt: string;
  updatedAt: string;
};

export type CashRegisterDetail = CashRegisterSummary & {
  storeId: string;
  store: { id: string; code: string; name: string; status: ReferentialStatus };
};

export type AuthResponse = {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
};

export type MeResponse = {
  user: AuthUser;
};

export type CategoryStatus = "ACTIVE" | "ARCHIVED";

export type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  status: CategoryStatus;
  sortOrder: number;
  parentId: string | null;
  depth: 1 | 2;
  productCount: number;
  activeProductCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryNode = CategorySummary & {
  children: CategoryNode[];
};

export type CategoryTreeResponse = {
  items: CategoryNode[];
  stats: {
    total: number;
    roots: number;
    children: number;
    leaves: number;
    archived: number;
    products: number;
  };
};

export type CategoryLeafOption = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
};

export type CategoryDetail = CategorySummary & {
  parent: { id: string; name: string; slug: string } | null;
  children: CategorySummary[];
};

export type ProductCategoryRef = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
};

export type ProductAuthorizedStoreStock = {
  code: string;
  stock: number;
};

export type ProductListItem = {
  id: string;
  reference: string;
  name: string;
  brand: string | null;
  originCountry: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  purchasePrice: number;
  officialPrice: number;
  discountPercent: number;
  finalPrice: number;
  status: ProductStatus;
  category: ProductCategoryRef;
  authorizedStoreCount: number;
  alertThreshold: number | null;
  alertThresholdDisplay: number;
  warehouseStock: number;
  authorizedStores: ProductAuthorizedStoreStock[];
  barcode: ProductBarcode | null;
  updatedAt: string;
};

export type ProductBarcode = {
  id: string;
  code: string;
  symbology: "CODE128";
  createdAt: string;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
  alertThreshold: number | null;
  createdById: string;
  createdAt: string;
};

export type ProductStoreAuthorization = {
  storeId: string;
  code: string;
  name: string;
  city: string | null;
  storeStatus: "ACTIVE" | "INACTIVE";
  isAuthorized: boolean;
};

export type ProductStoreAuthorizationList = {
  items: ProductStoreAuthorization[];
  authorizedCount: number;
};

export type PaginatedProducts = {
  items: ProductListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: {
    draft: number;
    active: number;
    inactive: number;
    archived: number;
  };
};

export type PricingOverviewItem = {
  id: string;
  reference: string;
  name: string;
  status: ProductStatus;
  purchasePrice: number;
  officialPrice: number;
  discountPercent: number;
  finalPrice: number;
  priceHistoryCount: number;
  discountHistoryCount: number;
  updatedAt: string;
};

export type PaginatedPricingOverview = {
  items: PricingOverviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PricingHistoryPriceRow = {
  id: string;
  purchasePrice: number;
  officialPrice: number;
  previousPurchasePrice: number | null;
  previousOfficialPrice: number | null;
  currency: string;
  validFrom: string;
  validTo: string | null;
  reason: string | null;
  createdById: string;
  createdByName: string | null;
};

export type PricingHistoryDiscountRow = {
  id: string;
  percent: number;
  previousPercent: number | null;
  validFrom: string;
  validTo: string | null;
  reason: string | null;
  createdById: string;
  createdByName: string | null;
};

export type BarcodeCoverage = "ALL" | "CODED" | "MISSING";

export type BarcodeCatalogItem = {
  id: string;
  reference: string;
  name: string;
  brand: string | null;
  photoUrl: string | null;
  status: ProductStatus;
  officialPrice: number;
  finalPrice: number;
  barcode: ProductBarcode | null;
  printCount: number;
  lastPrintedAt: string | null;
  updatedAt: string;
};

export type PaginatedBarcodeCatalog = {
  items: BarcodeCatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: {
    total: number;
    coded: number;
    missing: number;
  };
};

export type BarcodeLookup = {
  product: {
    id: string;
    reference: string;
    name: string;
    status: ProductStatus;
    officialPrice: number;
    discountPercent: number;
    finalPrice: number;
    photoUrl: string | null;
  };
  barcode: ProductBarcode | null;
  stock: { quantityOnHand: number; quantityAvailable: number } | null;
};

export type PosWorkspaceRegister = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  store: { id: string; code: string; name: string; city: string | null };
  openSession: {
    id: string;
    openedAt: string;
    openingFloatUsd: number;
    openingFloatCdf: number;
    openedByName: string;
  } | null;
};

export type PosWorkspace = {
  primaryStoreId: string | null;
  registers: PosWorkspaceRegister[];
};

export type PosCatalogItem = {
  id: string;
  reference: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  photoUrl: string | null;
  isAuthorized: boolean;
  officialPrice: number;
  discountPercent: number;
  finalPrice: number;
  stock: number;
};

export type PosCatalog = {
  storeId: string;
  items: PosCatalogItem[];
};

export type PosDailySalesReportPaymentRow = {
  method: PaymentMethod;
  paymentLines: number;
  amountUsd: number;
  cashCdfCollected: number;
};

export type PosDailySalesReportCashierRow = {
  name: string;
  sales: number;
  totalUsd: number;
};

export type PosDailySalesReportTicketRow = {
  number: string;
  completedAt: string;
  cashierName: string;
  totalUsd: number;
  status: "COMPLETED" | "VOIDED";
};

export type PosDailySalesReportOpenSession = {
  id: string;
  openedAt: string;
  openedByName: string;
  openingFloatUsd: number;
  openingFloatCdf: number;
  collectionsUsd: number;
  collectionsCdf: number;
  expensesUsd: number;
  expensesCdf: number;
  theoreticalBalanceUsd: number;
  theoreticalBalanceCdf: number;
  salesOnSession: number;
};

export type PosDailySalesReport = {
  reportDate: string;
  generatedAt: string;
  store: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    receiptHeader: string | null;
  };
  cashRegister: { id: string; code: string; name: string };
  openSession: PosDailySalesReportOpenSession | null;
  totals: {
    completedSales: number;
    voidedSales: number;
    grossUsd: number;
  };
  paymentBreakdown: PosDailySalesReportPaymentRow[];
  cashierBreakdown: PosDailySalesReportCashierRow[];
  tickets: PosDailySalesReportTicketRow[];
};

export type CashSessionDetail = {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  openingFloatUsd: number;
  openingFloatCdf: number;
  collectionsUsd: number;
  collectionsCdf: number;
  expensesUsd: number;
  expensesCdf: number;
  theoreticalBalanceUsd: number;
  theoreticalBalanceCdf: number;
  countedUsd: number | null;
  countedCdf: number | null;
  varianceUsd: number | null;
  varianceCdf: number | null;
  note: string | null;
  cashRegister: { id: string; code: string; name: string; isDefault: boolean };
  store: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
  };
  openedBy: { id: string; firstName: string; lastName: string };
  closedBy: { id: string; firstName: string; lastName: string } | null;
  salesCount: number;
};

export type SaleLineDetail = {
  id: string;
  productId: string;
  reference: string;
  name: string;
  barcode: string | null;
  quantity: number;
  officialUnitPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalUnitPrice: number;
  lineTotal: number;
};

export type PaymentMethod = "CASH" | "MPESA" | "ORANGE_MONEY" | "AIRTEL_MONEY";

export type SalePaymentDetail = {
  id: string;
  method: PaymentMethod;
  currency: "USD" | "CDF";
  amount: number;
  amountUsd: number;
  rateSnapshot: number | null;
  providerReference: string | null;
  paidAt: string;
};

export type ExchangeRateType = "ENCAISSEMENT" | "DECAISSEMENT";

export type ExchangeRateRow = {
  id: string;
  rateType: ExchangeRateType;
  rate: number;
  validFrom: string;
  validTo: string | null;
  createdById: string;
  createdByName: string | null;
};

export type ExchangeRatesCurrent = {
  encaissement: ExchangeRateRow | null;
  decaissement: ExchangeRateRow | null;
};

export type ExchangeRateRevision = {
  validFrom: string;
  encaissementRate: number;
  decaissementRate: number | null;
  createdByName: string | null;
  note: string | null;
};

export type SaleListItem = {
  id: string;
  number: string;
  status: "COMPLETED" | "VOIDED";
  total: number;
  currency: "USD";
  completedAt: string;
  store: { id: string; code: string; name: string };
  cashierName: string;
  lineCount: number;
  paymentMethods: PaymentMethod[];
  primaryPayment: {
    method: PaymentMethod;
    currency: "USD" | "CDF";
    amount: number;
    providerReference: string | null;
  } | null;
};

export type PaginatedSales = {
  items: SaleListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SalesSummary = {
  todayCount: number;
  todayTotalUsd: number;
  voidedCount: number;
};

export type PaymentListItem = {
  id: string;
  paidAt: string;
  method: PaymentMethod;
  currency: "USD" | "CDF";
  amount: number;
  amountUsd: number;
  rateSnapshot: number | null;
  providerReference: string | null;
  sale: {
    id: string;
    number: string;
    status: "COMPLETED" | "VOIDED";
    total: number;
    completedAt: string;
  };
  store: { id: string; code: string; name: string };
  cashierName: string;
};

export type PaginatedPayments = {
  items: PaymentListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaymentsSummary = {
  todayLineCount: number;
  todayAmountUsd: number;
  todayCashUsd: number;
  todayMobileUsd: number;
  todayCdfCollected: number;
};

export type CashSessionListItem = {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  openingFloatUsd: number;
  openingFloatCdf: number;
  store: { id: string; code: string; name: string };
  cashRegister: { id: string; code: string; name: string };
  openedByName: string;
  salesCount: number;
};

export type PaginatedCashSessions = {
  items: CashSessionListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SaleDetail = {
  id: string;
  number: string;
  status: "COMPLETED" | "VOIDED";
  storeId: string;
  cashSessionId: string;
  currency: "USD";
  subtotal: number;
  discountTotal: number;
  total: number;
  completedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  cashier: { id: string; firstName: string; lastName: string };
  store: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
  };
  items: SaleLineDetail[];
  payments: SalePaymentDetail[];
  idempotentReplay: boolean;
};

export type BarcodePrintContext = "SINGLE" | "BATCH";

export type BarcodePrintLogItem = {
  id: string;
  copies: number;
  context: BarcodePrintContext;
  createdAt: string;
  printedById: string;
  printedByName: string;
  barcode: ProductBarcode;
  product: { id: string; reference: string; name: string };
};

export type PaginatedBarcodePrintLogs = {
  items: BarcodePrintLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PrintBarcodesResult = {
  context: BarcodePrintContext;
  copies: number;
  items: BarcodeCatalogItem[];
  logs: BarcodePrintLogItem[];
};

export type GenerateMissingBarcodesResult = {
  generated: number;
  items: BarcodeCatalogItem[];
};

export type ProductPricingTimeline = {
  product: Pick<
    ProductListItem,
    "id" | "reference" | "name" | "status" | "purchasePrice" | "officialPrice" | "discountPercent" | "finalPrice"
  >;
  prices: PricingHistoryPriceRow[];
  discounts: PricingHistoryDiscountRow[];
  openPriceId: string | null;
  openDiscountId: string | null;
};

export type SupplierListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  status: ReferentialStatus;
  receiptCount: number;
  updatedAt: string;
};

export type SupplierDetail = SupplierListItem & {
  address: string | null;
  createdAt: string;
};

export type SupplierOption = {
  id: string;
  name: string;
  status: ReferentialStatus;
};

export type PaginatedSuppliers = {
  items: SupplierListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: { active: number; inactive: number };
};

export type GoodsReceiptStatus = "DRAFT" | "VALIDATED" | "CANCELLED";

export type GoodsReceiptLine = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  quantity: number;
  unitCost: string;
  note: string | null;
};

export type GoodsReceiptListItem = {
  id: string;
  reference: string;
  status: GoodsReceiptStatus;
  supplier: { id: string; name: string };
  warehouse: { id: string; code: string; name: string };
  lineCount: number;
  totalQuantity: number;
  createdAt: string;
  validatedAt: string | null;
};

export type GoodsReceiptDetail = GoodsReceiptListItem & {
  note: string | null;
  receivedAt: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  validatedBy: { id: string; firstName: string; lastName: string } | null;
  items: GoodsReceiptLine[];
  updatedAt: string;
};

export type PaginatedGoodsReceipts = {
  items: GoodsReceiptListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type GoodsReceiptValidateResult = GoodsReceiptDetail & {
  stock: Array<{ productId: string; quantityOnHand: number }>;
};

export type StockAlertStatus = "OK" | "LOW" | "STOCKOUT";

export type StockLevelItem = {
  id: string;
  product: { id: string; reference: string; name: string; alertThreshold: number | null };
  warehouse: { id: string; code: string; name: string } | null;
  store: { id: string; code: string; name: string } | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  effectiveThreshold: number;
  alertStatus: StockAlertStatus;
  updatedAt: string;
};

export type StockMovementItem = {
  id: string;
  product: { id: string; reference: string; name: string };
  warehouse: { id: string; code: string; name: string } | null;
  store: { id: string; code: string; name: string } | null;
  movementType: string;
  direction: "IN" | "OUT";
  quantity: number;
  unitCost: string | null;
  sourceType: string;
  sourceId: string;
  note: string | null;
  occurredAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
};

export type PaginatedStockLevels = {
  items: StockLevelItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedStockMovements = {
  items: StockMovementItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type StockSummary = {
  totalLevels: number;
  ok: number;
  low: number;
  stockout: number;
};

export type StockManualAdjustmentResult = {
  movementId: string;
  quantityOnHand: number;
  previousOnHand: number;
};

export type StockReconcileResult = {
  checked: number;
  discrepancyCount: number;
  discrepancies: Array<{
    stockLevelId: string;
    productId: string;
    delta: number;
    quantityOnHand: number;
    movementSum: number;
  }>;
};

export type TransferStatus =
  | "DRAFT"
  | "PENDING"
  | "VALIDATED"
  | "PREPARING"
  | "SHIPPED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type TransferPerson = { id: string; firstName: string; lastName: string };

export type TransferPlace = { id: string; code: string; name: string };

export type TransferLine = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  quantityRequested: number;
  quantityShipped: number;
  quantityReceived: number;
  unitCost: string | null;
  variance: number | null;
};

export type TransferListLineItem = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  quantityRequested: number;
  quantityShipped: number;
  quantityReceived: number;
  /** Expédié − reçu (comme HD). */
  discrepancy: number;
  /** @deprecated Utiliser discrepancy. */
  variance?: number;
};

export type TransferListItem = {
  id: string;
  reference: string;
  status: TransferStatus;
  warehouse: TransferPlace;
  store: TransferPlace;
  lineCount: number;
  totalRequested: number;
  totalShipped: number;
  totalReceived: number;
  hasVariance: boolean;
  createdAt: string;
  validatedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  items: TransferListLineItem[];
};

export type TransferDetail = TransferListItem & {
  note: string | null;
  cancelReason: string | null;
  createdBy: TransferPerson;
  validatedBy: TransferPerson | null;
  shippedBy: TransferPerson | null;
  receivedBy: TransferPerson | null;
  cancelledAt: string | null;
  items: TransferLine[];
  updatedAt: string;
};

export type PaginatedTransfers = {
  items: TransferListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AppNotificationItem = {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  storeId: string | null;
  createdAt: string;
  readAt: string | null;
};

export type TransferSummary = {
  draft: number;
  pending: number;
  validated: number;
  preparing: number;
  shipped: number;
  partiallyReceived: number;
  received: number;
  cancelled: number;
  toPrepare: number;
  inTransit: number;
  withVariance: number;
};

export type TransferCatalogItem = {
  productId: string;
  reference: string;
  name: string;
  purchasePrice: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
};

export type TransferDestination = {
  id: string;
  code: string;
  name: string;
  city: string | null;
};

export type InventoryStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "PENDING_VALIDATION"
  | "VALIDATED"
  | "CANCELLED";

export type InventoryScopeType = "WAREHOUSE" | "STORE";

export type InventoryLine = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  theoreticalQty: number;
  physicalQty: number | null;
  variance: number | null;
  justification: string | null;
  initialQty: number;
  receiptsQty: number;
  transfersInQty: number;
  transfersOutQty: number;
  salesQty: number;
  internalIssuesQty: number;
  adjustmentsQty: number;
};

export type InventoryListItem = {
  id: string;
  reference: string;
  status: InventoryStatus;
  scopeType: InventoryScopeType;
  warehouse: { id: string; code: string; name: string } | null;
  store: { id: string; code: string; name: string } | null;
  lineCount: number;
  countedLines: number;
  varianceLines: number;
  totalVarianceUnits: number;
  startedAt: string | null;
  validatedAt: string | null;
  closedAt: string | null;
};

export type InventoryDetail = InventoryListItem & {
  note: string | null;
  startedBy: { id: string; firstName: string; lastName: string };
  validatedBy: { id: string; firstName: string; lastName: string } | null;
  items: InventoryLine[];
  updatedAt: string;
};

export type PaginatedInventories = {
  items: InventoryListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type InventorySummary = {
  draft: number;
  inProgress: number;
  pendingValidation: number;
  validated: number;
  cancelled: number;
  open: number;
  withVariance: number;
};

export type InventoryLocationOption = {
  scopeType: InventoryScopeType;
  warehouse?: { id: string; code: string; name: string };
  store?: { id: string; code: string; name: string; city: string | null };
};

export type InternalIssueReason = "CLEANING" | "MAINTENANCE" | "INTERNAL_USE" | "DAMAGED" | "OTHER";

export type InternalIssueStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type InternalIssueScopeType = "WAREHOUSE" | "STORE";

export type InternalIssueListItem = {
  id: string;
  reference: string;
  status: InternalIssueStatus;
  scopeType: InternalIssueScopeType;
  warehouse: { id: string; code: string; name: string } | null;
  store: { id: string; code: string; name: string } | null;
  productReference: string;
  productName: string;
  quantity: number;
  reasonCode: InternalIssueReason;
  reasonText: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
  storeConfirmedAt: string | null;
  storeConfirmedBy: { id: string; firstName: string; lastName: string } | null;
};

export type InternalIssueDetail = InternalIssueListItem & {
  productId: string;
  reasonText: string | null;
  reviewNote: string | null;
  requestedBy: { id: string; firstName: string; lastName: string };
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
  updatedAt: string;
};

export type PaginatedInternalIssues = {
  items: InternalIssueListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type InternalIssueSummary = {
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  open: number;
  toValidate: number;
};

export type InternalIssueLocationOption = {
  scopeType: InternalIssueScopeType;
  warehouse?: { id: string; code: string; name: string };
  store?: { id: string; code: string; name: string; city: string | null };
};

export type InternalIssueCatalogItem = {
  productId: string;
  reference: string;
  name: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
};

export type ExpenseCategoryCode =
  | "TRANSPORT"
  | "DELIVERY"
  | "HANDLING"
  | "ELECTRICITY"
  | "MAINTENANCE"
  | "OTHER";

export type ExpenseScopeType = "STORE" | "WAREHOUSE";

export type ExpenseLocationOption =
  | {
      scopeType: "WAREHOUSE";
      warehouse: { id: string; code: string; name: string };
    }
  | {
      scopeType: "STORE";
      store: { id: string; code: string; name: string; city: string | null };
      openSession: { id: string; cashRegisterId: string; cashRegisterCode: string } | null;
    };

export type ExpenseStatus = "CONFIRMED" | "PENDING_CASHIER_CONFIRMATION" | "CANCELLED";

export type ExpenseListItem = {
  id: string;
  reference: string;
  status: ExpenseStatus;
  category: ExpenseCategoryCode;
  amount: number;
  currency: "USD" | "CDF";
  amountUsdEquivalent: number;
  spentAt: string;
  description: string | null;
  receiptUrl: string | null;
  fromCashDrawer: boolean;
  scopeType: ExpenseScopeType;
  store: { id: string; code: string; name: string; city: string | null } | null;
  warehouse: { id: string; code: string; name: string } | null;
  cashRegister: { id: string; code: string; name: string } | null;
  createdByName: string;
  cashierConfirmedAt: string | null;
  cashierConfirmedByName: string | null;
  cashSessionId: string | null;
};

export type ExpenseDetail = ExpenseListItem & {
  createdAt: string;
  updatedAt: string;
};

export type ExpensesSummary = {
  todayCount: number;
  todayAmountUsd: number;
  monthAmountUsd: number;
  drawerTodayUsd: number;
  pendingCashierToday: number;
  decaissementRate: number | null;
};

export type PaginatedExpenses = {
  items: ExpenseListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuditDomain =
  | "identity"
  | "network"
  | "catalog"
  | "stock"
  | "sales"
  | "finance"
  | "settings";

export type AuditActorSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
} | null;

export type AuditStoreSummary = {
  id: string;
  code: string;
  name: string;
} | null;

export type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  storeId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: AuditActorSummary;
  store: AuditStoreSummary;
  summary: string;
  sensitive: boolean;
};

export type PaginatedAuditLogs = {
  items: AuditLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuditLogsSummary = {
  todayCount: number;
  last7DaysCount: number;
  sensitiveTodayCount: number;
  uniqueActorsToday: number;
};

export type AuditLogsCatalog = {
  domains: AuditDomain[];
  actions: { value: string; domain: AuditDomain }[];
  entityTypes: string[];
};

export type LoginHistoryUserSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleCode: string;
  roleName: string;
};

export type LoginHistoryItem = {
  id: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: LoginHistoryUserSummary | null;
};

export type PaginatedLoginHistories = {
  items: LoginHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type LoginHistoriesSummary = {
  todayTotal: number;
  todaySuccess: number;
  todayFailed: number;
  last7DaysFailed: number;
  failedLast24h: number;
  unknownAttemptsToday: number;
};
