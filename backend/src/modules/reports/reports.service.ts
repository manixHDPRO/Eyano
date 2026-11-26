import { HttpStatus, Injectable } from "@nestjs/common";
import {
  CashSessionStatus,
  CurrencyCode,
  ExchangeRateType,
  ExpenseStatus,
  PaymentMethod,
  Prisma,
  ProductStatus,
  ReferentialStatus,
  SaleStatus,
  TransferStatus,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { SETTING_STOCK_ALERT_DEFAULT } from "../stock-movements/stock-movements.constants";
import type { ReportsOverviewQueryDto } from "./dto/reports-overview.query.dto";
import type { ReportsTopProductsQueryDto } from "./dto/reports-top-products.query.dto";
import type {
  ReportsActiveTransfer,
  ReportsCashVariance,
  ReportsOverviewResponse,
  ReportsRecentSale,
  ReportsStockRow,
  ReportsStockSection,
  ReportsStoreRow,
  ReportsTopProduct,
  ReportsTopProductsResponse,
  ReportsTransfersSection,
} from "./reports.types";

const STOCK_ROW_LIMIT = 300;
const ACTIVE_TRANSFER_STATUSES: TransferStatus[] = [
  TransferStatus.DRAFT,
  TransferStatus.PENDING,
  TransferStatus.VALIDATED,
  TransferStatus.PREPARING,
  TransferStatus.SHIPPED,
  TransferStatus.PARTIALLY_RECEIVED,
];
const ACTIVE_TRANSFERS_PREVIEW = 8;
const TOP_PRODUCTS_LIMIT = 25;
const TOP_PRODUCTS_BY_QTY_DEFAULT = 100;
const RECENT_SALES_LIMIT = 12;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async overview(actor: AuthUser, query: ReportsOverviewQueryDto): Promise<ReportsOverviewResponse> {
    const context = await this.access.loadContext(actor.id);
    const isGlobalScope = context.isGlobalScope;
    const showWarehouse = isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER";
    const canStock = context.permissions.includes("stock.read") || context.permissions.includes("reports.read");

    const decaissementRate = await readDecaissementRate(this.prisma);
    const rates = await this.prisma.exchangeRate.findMany({
      where: { validTo: null },
      select: { rateType: true, rate: true },
    });
    const enc = rates.find((r) => r.rateType === ExchangeRateType.ENCAISSEMENT);
    const dec = rates.find((r) => r.rateType === ExchangeRateType.DECAISSEMENT);

    const saleScopeBase = this.buildSaleScope(actor, isGlobalScope);
    const expenseScopeBase = this.buildExpenseScope(actor, isGlobalScope);
    const storeScope = this.buildStoreScope(actor, isGlobalScope);

    const storeFilter = query.storeId?.trim();
    const completedAt = buildCompletedAtFilter(query.from, query.to);

    const saleWhere: Prisma.SaleWhereInput = {
      ...saleScopeBase,
      status: SaleStatus.COMPLETED,
      ...(storeFilter ? { storeId: storeFilter } : {}),
      ...(completedAt ? { completedAt } : {}),
    };

    const expenseWhere: Prisma.ExpenseWhereInput = {
      ...expenseScopeBase,
      status: { not: ExpenseStatus.CANCELLED },
      ...(storeFilter ? { storeId: storeFilter } : {}),
      ...(buildSpentAtFilter(query.from, query.to) ? { spentAt: buildSpentAtFilter(query.from, query.to) } : {}),
    };

    const canTransfers =
      context.permissions.includes("transfers.read") ||
      context.permissions.includes("transfers.create") ||
      context.permissions.includes("reports.read");
    const transferScope = canTransfers ? await this.buildTransferScope(actor, isGlobalScope, storeFilter) : null;

    const [
      saleAgg,
      salesCount,
      expenseRows,
      stores,
      salesByStoreGroup,
      expenseByStoreRows,
      saleItems,
      paymentGroups,
      currencyGroups,
      cashSessions,
      recentSalesRows,
      activeTransferGroups,
      activeTransferRows,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: saleWhere,
        _sum: { total: true, discountTotal: true },
      }),
      this.prisma.sale.count({ where: saleWhere }),
      this.prisma.expense.findMany({
        where: expenseWhere,
        select: { amount: true, currency: true, storeId: true },
      }),
      this.prisma.store.findMany({
        where: { ...storeScope, ...(storeFilter ? { id: storeFilter } : {}) },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true },
      }),
      this.prisma.sale.groupBy({
        by: ["storeId"],
        where: saleWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.expense.findMany({
        where: expenseWhere,
        select: { storeId: true, amount: true, currency: true },
      }),
      this.prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
          productId: true,
          referenceSnapshot: true,
          nameSnapshot: true,
          quantity: true,
          lineTotal: true,
          purchasePriceSnapshot: true,
        },
      }),
      this.prisma.payment.groupBy({
        by: ["method"],
        where: { sale: saleWhere },
        _sum: { amountUsd: true },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ["currency"],
        where: { sale: saleWhere },
        _sum: { amount: true },
      }),
      this.loadCashVariances(actor, isGlobalScope, storeFilter, query.from, query.to),
      this.prisma.sale.findMany({
        where: saleWhere,
        orderBy: [{ completedAt: "desc" }],
        take: RECENT_SALES_LIMIT,
        select: {
          id: true,
          number: true,
          total: true,
          completedAt: true,
          store: { select: { name: true } },
        },
      }),
      transferScope
        ? this.prisma.transfer.groupBy({
            by: ["status"],
            where: { ...transferScope, status: { in: ACTIVE_TRANSFER_STATUSES } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      transferScope
        ? this.prisma.transfer.findMany({
            where: { ...transferScope, status: { in: ACTIVE_TRANSFER_STATUSES } },
            orderBy: [{ updatedAt: "desc" }],
            take: ACTIVE_TRANSFERS_PREVIEW,
            select: {
              id: true,
              reference: true,
              status: true,
              createdAt: true,
              store: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const revenueUsd = roundMoney(saleAgg._sum.total);
    const discountsUsd = roundMoney(saleAgg._sum.discountTotal);
    const costUsd = roundMoney(
      saleItems.reduce((acc, row) => acc + Number(row.purchasePriceSnapshot) * row.quantity, 0),
    );
    const expensesUsd = roundMoney(sumExpensesUsd(expenseRows, decaissementRate));
    const grossMarginUsd = roundMoney(revenueUsd - costUsd);
    const netResultUsd = roundMoney(grossMarginUsd - expensesUsd);

    const collectionsByMethod: Partial<Record<PaymentMethod, { count: number; totalUsd: number }>> = {};
    for (const row of paymentGroups) {
      collectionsByMethod[row.method] = {
        count: row._count._all,
        totalUsd: roundMoney(row._sum.amountUsd),
      };
    }

    let collectionsUsd = 0;
    let collectionsCdf = 0;
    for (const row of currencyGroups) {
      const sum = roundMoney(row._sum.amount);
      if (row.currency === CurrencyCode.USD) {
        collectionsUsd = sum;
      } else {
        collectionsCdf = sum;
      }
    }

    const salesByStoreId = new Map(
      salesByStoreGroup.map((row) => [
        row.storeId,
        { revenueUsd: roundMoney(row._sum.total), salesCount: row._count._all },
      ]),
    );

    const expensesByStoreId = new Map<string, number>();
    for (const row of expenseByStoreRows) {
      if (!row.storeId) {
        continue;
      }
      const usd = toUsdEquivalent(Number(row.amount), row.currency, decaissementRate);
      expensesByStoreId.set(row.storeId, roundMoney((expensesByStoreId.get(row.storeId) ?? 0) + usd));
    }

    const byStore: ReportsStoreRow[] = stores.map((store) => {
      const stats = salesByStoreId.get(store.id);
      return {
        storeId: store.id,
        code: store.code,
        name: store.name,
        salesCount: stats?.salesCount ?? 0,
        revenueUsd: stats?.revenueUsd ?? 0,
        expensesUsd: expensesByStoreId.get(store.id) ?? 0,
      };
    });

    const topProducts = buildTopProducts(saleItems, { sortBy: "revenue", limit: TOP_PRODUCTS_LIMIT });

    const stock = canStock
      ? await this.buildStockSection(actor, isGlobalScope, showWarehouse, storeFilter)
      : null;

    const recentSales: ReportsRecentSale[] = recentSalesRows.map((row) => ({
      id: row.id,
      saleNumber: row.number,
      storeName: row.store.name,
      totalUsd: Number(row.total),
      completedAt: row.completedAt.toISOString(),
    }));

    const activeTransfers = transferScope ? buildActiveTransfersSection(activeTransferGroups, activeTransferRows) : null;

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      storeId: storeFilter ?? null,
      exchangeRates: {
        encaissementRate: enc ? Number(enc.rate) : null,
        decaissementRate: dec ? Number(dec.rate) : null,
      },
      financialSummary: {
        revenueUsd,
        costUsd,
        grossMarginUsd,
        discountsUsd,
        expensesUsd,
        netResultUsd,
        salesCount,
        collectionsByCurrency: { usd: collectionsUsd, cdf: collectionsCdf },
        collectionsByMethod,
      },
      byStore,
      topProducts,
      stock,
      cashVariances: cashSessions,
      recentSales,
      activeTransfers,
    };
  }

  async topProductsByQuantity(
    actor: AuthUser,
    query: ReportsTopProductsQueryDto,
  ): Promise<ReportsTopProductsResponse> {
    const context = await this.access.loadContext(actor.id);
    const isGlobalScope = context.isGlobalScope;
    const storeScope = this.buildStoreScope(actor, isGlobalScope);
    const storeFilter = query.storeId.trim();

    const store = await this.prisma.store.findFirst({
      where: { id: storeFilter, ...storeScope },
      select: { id: true, code: true, name: true },
    });
    if (!store) {
      throw new ApiException("STORE_NOT_FOUND", "Boutique introuvable ou hors périmètre.", HttpStatus.NOT_FOUND);
    }

    const completedAt = buildCompletedAtFilter(query.from, query.to);
    const saleScopeBase = this.buildSaleScope(actor, isGlobalScope);
    const saleWhere: Prisma.SaleWhereInput = {
      ...saleScopeBase,
      status: SaleStatus.COMPLETED,
      storeId: storeFilter,
      ...(completedAt ? { completedAt } : {}),
    };

    const saleItems = await this.prisma.saleItem.findMany({
      where: { sale: saleWhere },
      select: {
        productId: true,
        referenceSnapshot: true,
        nameSnapshot: true,
        quantity: true,
        lineTotal: true,
        purchasePriceSnapshot: true,
      },
    });

    const limit = query.limit ?? TOP_PRODUCTS_BY_QTY_DEFAULT;
    const items = buildTopProducts(saleItems, { sortBy: "qty", limit });

    const totalQtySold = items.reduce((acc, row) => acc + row.qtySold, 0);
    const totalRevenueUsd = roundMoney(items.reduce((acc, row) => acc + row.revenueUsd, 0));

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      store,
      items,
      totalQtySold,
      totalRevenueUsd,
    };
  }

  private async buildTransferScope(
    actor: AuthUser,
    isGlobalScope: boolean,
    storeFilter?: string,
  ): Promise<Prisma.TransferWhereInput> {
    if (storeFilter) {
      return { storeId: storeFilter };
    }
    if (isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      return {};
    }
    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: storeIds } };
  }

  private async buildStockSection(
    actor: AuthUser,
    isGlobalScope: boolean,
    showWarehouse: boolean,
    storeFilter?: string,
  ): Promise<ReportsStockSection> {
    const stockLevelWhere = await this.buildStockLevelScope(actor, isGlobalScope, storeFilter);
    const defaultThreshold = await readDefaultThreshold(this.prisma);

    const levels = await this.prisma.stockLevel.findMany({
      where: stockLevelWhere,
      select: {
        quantityOnHand: true,
        warehouseId: true,
        storeId: true,
        product: {
          select: {
            id: true,
            reference: true,
            name: true,
            status: true,
            alertThreshold: true,
            purchasePrice: true,
          },
        },
      },
    });

    const byProduct = new Map<
      string,
      {
        reference: string;
        name: string;
        purchasePrice: number;
        alertThreshold: number | null;
        warehouseQty: number;
        storesQty: number;
      }
    >();

    for (const level of levels) {
      if (level.product.status === ProductStatus.ARCHIVED) {
        continue;
      }
      const existing = byProduct.get(level.product.id) ?? {
        reference: level.product.reference,
        name: level.product.name,
        purchasePrice: Number(level.product.purchasePrice),
        alertThreshold: level.product.alertThreshold,
        warehouseQty: 0,
        storesQty: 0,
      };
      const isWarehouse = level.warehouseId !== null && level.storeId === null;
      if (isWarehouse && showWarehouse) {
        existing.warehouseQty += level.quantityOnHand;
      } else if (level.storeId) {
        existing.storesQty += level.quantityOnHand;
      }
      byProduct.set(level.product.id, existing);
    }

    const rows: ReportsStockRow[] = [];
    let totalValuationUsd = 0;
    let totalUnits = 0;

    for (const [productId, agg] of byProduct) {
      const totalQty = agg.warehouseQty + agg.storesQty;
      if (totalQty <= 0 && !showWarehouse) {
        continue;
      }
      const valuationUsd = roundMoney(totalQty * agg.purchasePrice);
      totalValuationUsd += valuationUsd;
      totalUnits += totalQty;
      rows.push({
        productId,
        reference: agg.reference,
        name: agg.name,
        warehouseQty: agg.warehouseQty,
        storesQty: agg.storesQty,
        totalQty,
        valuationUsd,
        alertThreshold: agg.alertThreshold ?? defaultThreshold,
      });
    }

    rows.sort((a, b) => b.valuationUsd - a.valuationUsd || a.reference.localeCompare(b.reference, "fr"));
    const truncated = rows.length > STOCK_ROW_LIMIT;
    const slice = rows.slice(0, STOCK_ROW_LIMIT);

    return {
      rows: slice,
      totalValuationUsd: roundMoney(totalValuationUsd),
      totalUnits,
      truncated,
      showWarehouse,
    };
  }

  private async loadCashVariances(
    actor: AuthUser,
    isGlobalScope: boolean,
    storeFilter: string | undefined,
    from?: string,
    to?: string,
  ): Promise<ReportsCashVariance[]> {
    const registerWhere: Prisma.CashRegisterWhereInput = { status: ReferentialStatus.ACTIVE };
    if (!isGlobalScope && actor.role.code !== "WAREHOUSE_MANAGER") {
      const storeIds = actor.stores.map((s) => s.id);
      if (storeIds.length === 0) {
        return [];
      }
      registerWhere.storeId = storeFilter ? storeFilter : { in: storeIds };
    } else if (storeFilter) {
      registerWhere.storeId = storeFilter;
    }

    const registers = await this.prisma.cashRegister.findMany({
      where: registerWhere,
      select: { id: true },
    });
    if (registers.length === 0) {
      return [];
    }

    const closedAt = buildClosedAtFilter(from, to);
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        status: CashSessionStatus.CLOSED,
        cashRegisterId: { in: registers.map((r) => r.id) },
        ...(closedAt ? { closedAt } : {}),
      },
      orderBy: [{ closedAt: "desc" }],
      take: 40,
      select: {
        id: true,
        closedAt: true,
        varianceUsd: true,
        varianceCdf: true,
        cashRegister: {
          select: {
            code: true,
            name: true,
            store: { select: { name: true } },
          },
        },
      },
    });

    return sessions
      .filter((row) => row.closedAt)
      .map((row) => ({
        sessionId: row.id,
        storeName: row.cashRegister.store.name,
        registerLabel: `${row.cashRegister.code} · ${row.cashRegister.name}`,
        closedAt: row.closedAt!.toISOString(),
        varianceUsd: row.varianceUsd !== null ? Number(row.varianceUsd) : 0,
        varianceCdf: row.varianceCdf !== null ? Number(row.varianceCdf) : 0,
      }));
  }

  private buildSaleScope(actor: AuthUser, isGlobalScope: boolean): Prisma.SaleWhereInput {
    if (isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      return {};
    }
    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: storeIds } };
  }

  private buildStoreScope(actor: AuthUser, isGlobalScope: boolean): Prisma.StoreWhereInput {
    const base: Prisma.StoreWhereInput = { status: ReferentialStatus.ACTIVE };
    if (isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      return base;
    }
    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { ...base, id: { in: storeIds } };
  }

  private buildExpenseScope(actor: AuthUser, isGlobalScope: boolean): Prisma.ExpenseWhereInput {
    if (isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      return {};
    }
    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: storeIds } };
  }

  private async buildStockLevelScope(
    actor: AuthUser,
    isGlobalScope: boolean,
    storeFilter?: string,
  ): Promise<Prisma.StockLevelWhereInput> {
    if (storeFilter) {
      return { storeId: storeFilter, warehouseId: null };
    }
    if (isGlobalScope) {
      return {};
    }
    if (actor.role.code === "WAREHOUSE_MANAGER") {
      return { warehouseId: { not: null }, storeId: null };
    }
    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: storeIds }, warehouseId: null };
  }
}

type TopProductsSortBy = "revenue" | "qty";

function buildTopProducts(
  saleItems: Array<{
    productId: string;
    referenceSnapshot: string;
    nameSnapshot: string;
    quantity: number;
    lineTotal: Prisma.Decimal;
    purchasePriceSnapshot: Prisma.Decimal;
  }>,
  options?: { sortBy?: TopProductsSortBy; limit?: number },
): ReportsTopProduct[] {
  const sortBy = options?.sortBy ?? "revenue";
  const limit = options?.limit ?? TOP_PRODUCTS_LIMIT;
  const map = new Map<string, ReportsTopProduct>();

  for (const row of saleItems) {
    const existing = map.get(row.productId) ?? {
      productId: row.productId,
      reference: row.referenceSnapshot,
      name: row.nameSnapshot,
      qtySold: 0,
      revenueUsd: 0,
      marginUsd: 0,
    };
    const lineTotal = Number(row.lineTotal);
    const lineCost = Number(row.purchasePriceSnapshot) * row.quantity;
    existing.qtySold += row.quantity;
    existing.revenueUsd = roundMoney(existing.revenueUsd + lineTotal);
    existing.marginUsd = roundMoney(existing.marginUsd + (lineTotal - lineCost));
    map.set(row.productId, existing);
  }

  return [...map.values()]
    .sort((a, b) => {
      if (sortBy === "qty") {
        return b.qtySold - a.qtySold || b.revenueUsd - a.revenueUsd;
      }
      return b.revenueUsd - a.revenueUsd || b.qtySold - a.qtySold;
    })
    .slice(0, limit)
    .map((row) => ({
      ...row,
      revenueUsd: roundMoney(row.revenueUsd),
      marginUsd: roundMoney(row.marginUsd),
    }));
}

function buildCompletedAtFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    filter.gte = new Date(from);
  }
  if (to) {
    filter.lte = new Date(to);
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

function buildSpentAtFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  return buildCompletedAtFilter(from, to);
}

function buildClosedAtFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  return buildCompletedAtFilter(from, to);
}

function roundMoney(value: Prisma.Decimal | number | null | undefined): number {
  const n = value === null || value === undefined ? 0 : Number(value);
  return Number(n.toFixed(2));
}

function sumExpensesUsd(
  rows: { amount: Prisma.Decimal; currency: CurrencyCode }[],
  decaissementRate: number | null,
): number {
  return rows.reduce((acc, row) => acc + toUsdEquivalent(Number(row.amount), row.currency, decaissementRate), 0);
}

function toUsdEquivalent(amount: number, currency: CurrencyCode, decaissementRate: number | null): number {
  if (currency === CurrencyCode.USD) {
    return amount;
  }
  const rate = decaissementRate && decaissementRate > 0 ? decaissementRate : null;
  if (!rate) {
    return 0;
  }
  return amount / rate;
}

async function readDefaultThreshold(prisma: PrismaService): Promise<number> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_STOCK_ALERT_DEFAULT } });
  return typeof setting?.value === "number" ? setting.value : 100;
}

async function readDecaissementRate(prisma: PrismaService): Promise<number | null> {
  const row = await prisma.exchangeRate.findFirst({
    where: { rateType: ExchangeRateType.DECAISSEMENT, validTo: null },
    select: { rate: true },
  });
  return row ? Number(row.rate) : null;
}

function buildActiveTransfersSection(
  groups: { status: TransferStatus; _count: { _all: number } }[],
  rows: Array<{
    id: string;
    reference: string;
    status: TransferStatus;
    createdAt: Date;
    store: { name: string };
  }>,
): ReportsTransfersSection {
  const byStatus: Partial<Record<TransferStatus, number>> = {};
  let activeCount = 0;
  for (const row of groups) {
    byStatus[row.status] = row._count._all;
    activeCount += row._count._all;
  }
  const recent: ReportsActiveTransfer[] = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    status: row.status,
    storeName: row.store.name,
    createdAt: row.createdAt.toISOString(),
  }));
  return { activeCount, byStatus, recent };
}