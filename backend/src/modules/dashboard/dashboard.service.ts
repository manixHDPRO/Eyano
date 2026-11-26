import { Injectable } from "@nestjs/common";
import {
  CashSessionStatus,
  CurrencyCode,
  ExchangeRateType,
  ExpenseStatus,
  Prisma,
  ReferentialStatus,
  SaleStatus,
  TransferStatus,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { ExpensesService } from "../expenses/expenses.service";
import { SETTING_STOCK_ALERT_DEFAULT } from "../stock-movements/stock-movements.constants";
import type {
  AdminDashboardResponse,
  DashboardKpis,
  DashboardLowStockAlert,
  DashboardRecentSale,
  DashboardRecentTransfer,
  DashboardStorePerformance,
  DashboardTodayExpenses,
} from "./dashboard.types";

const ACTIVE_TRANSFER_STATUSES: TransferStatus[] = [
  TransferStatus.DRAFT,
  TransferStatus.PENDING,
  TransferStatus.VALIDATED,
  TransferStatus.PREPARING,
  TransferStatus.SHIPPED,
  TransferStatus.PARTIALLY_RECEIVED,
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly expenses: ExpensesService,
  ) {}

  async get(actor: AuthUser): Promise<AdminDashboardResponse> {
    const context = await this.access.loadContext(actor.id);
    const defaultThreshold = await readDefaultThreshold(this.prisma);
    const decaissementRate = await readDecaissementRate(this.prisma);

    const saleScope = this.buildSaleScope(actor, context.isGlobalScope);
    const transferScope = await this.buildTransferScope(actor, context.isGlobalScope);
    const stockLevelWhere = await this.buildStockLevelScope(actor, context.isGlobalScope);
    const expenseWhere = await this.buildExpenseScope(actor, context.isGlobalScope);
    const storeScope = this.buildStoreScope(actor, context.isGlobalScope);
    const showWarehouse = context.isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER";

    const [
      stores,
      saleAggregate,
      salesCount,
      expenseRows,
      stockLevels,
      transfersPending,
      recentSalesRows,
      recentTransferRows,
      openSessions,
      rates,
      todayExpensesRaw,
    ] = await Promise.all([
      this.prisma.store.findMany({
        where: storeScope,
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true },
      }),
      this.prisma.sale.aggregate({
        where: { ...saleScope, status: SaleStatus.COMPLETED },
        _sum: { total: true, discountTotal: true },
      }),
      this.prisma.sale.count({ where: { ...saleScope, status: SaleStatus.COMPLETED } }),
      this.prisma.expense.findMany({
        where: { ...expenseWhere, status: { not: ExpenseStatus.CANCELLED } },
        select: { amount: true, currency: true },
      }),
      this.prisma.stockLevel.findMany({
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
              alertThreshold: true,
              purchasePrice: true,
            },
          },
          warehouse: { select: { name: true } },
          store: { select: { name: true } },
        },
      }),
      this.prisma.transfer.count({
        where: { ...transferScope, status: { in: ACTIVE_TRANSFER_STATUSES } },
      }),
      this.prisma.sale.findMany({
        where: { ...saleScope, status: SaleStatus.COMPLETED },
        orderBy: [{ completedAt: "desc" }],
        take: 8,
        select: {
          id: true,
          number: true,
          currency: true,
          total: true,
          completedAt: true,
          payments: {
            orderBy: [{ paidAt: "asc" }],
            take: 1,
            select: { method: true, currency: true, amount: true },
          },
        },
      }),
      this.prisma.transfer.findMany({
        where: transferScope,
        orderBy: [{ createdAt: "desc" }],
        take: 6,
        select: {
          id: true,
          reference: true,
          status: true,
          createdAt: true,
          store: { select: { name: true } },
        },
      }),
      this.countOpenCashSessions(actor, context.isGlobalScope),
      this.prisma.exchangeRate.findMany({
        where: { validTo: null },
        select: { rateType: true, rate: true },
      }),
      this.expenses.todayForDashboard(actor),
    ]);

    let warehouseValueUsd: number | null = null;
    let totalWarehouseUnits: number | null = null;
    const lowStockAlerts: DashboardLowStockAlert[] = [];
    const stockUnitsByStore = new Map<string, number>();

    for (const level of stockLevels) {
      const threshold = level.product.alertThreshold ?? defaultThreshold;
      const quantity = level.quantityOnHand;
      const isWarehouse = level.warehouseId !== null && level.storeId === null;

      if (isWarehouse && showWarehouse) {
        totalWarehouseUnits = (totalWarehouseUnits ?? 0) + quantity;
        warehouseValueUsd =
          (warehouseValueUsd ?? 0) + quantity * Number(level.product.purchasePrice);
      }

      if (level.storeId) {
        stockUnitsByStore.set(level.storeId, (stockUnitsByStore.get(level.storeId) ?? 0) + quantity);
      }

      if (quantity > threshold) {
        continue;
      }

      lowStockAlerts.push({
        productId: level.product.id,
        reference: level.product.reference,
        name: level.product.name,
        locationKind: isWarehouse ? "WAREHOUSE" : "STORE",
        locationName: isWarehouse
          ? level.warehouse?.name ?? "Entrepôt central"
          : level.store?.name ?? "Boutique",
        quantity,
        threshold,
      });
    }

    lowStockAlerts.sort((a, b) => a.quantity - b.quantity);

    const salesGrouped = await this.prisma.sale.groupBy({
      by: ["storeId"],
      where: { ...saleScope, status: SaleStatus.COMPLETED },
      _sum: { total: true },
      _count: { _all: true },
    });
    const salesByStoreId = new Map(
      salesGrouped.map((row) => [
        row.storeId,
        { revenueUsd: roundMoney(row._sum.total), salesCount: row._count._all },
      ]),
    );

    const salesByStore: DashboardStorePerformance[] = stores.map((store) => {
      const stats = salesByStoreId.get(store.id);
      return {
        storeId: store.id,
        code: store.code,
        name: store.name,
        salesCount: stats?.salesCount ?? 0,
        revenueUsd: stats?.revenueUsd ?? 0,
        stockUnits: stockUnitsByStore.get(store.id) ?? 0,
      };
    });

    const kpis: DashboardKpis = {
      totalSalesUsd: roundMoney(saleAggregate._sum.total),
      salesCount,
      totalDiscountsUsd: roundMoney(saleAggregate._sum.discountTotal),
      totalExpensesUsd: roundMoney(sumExpensesUsd(expenseRows, decaissementRate)),
      warehouseValueUsd: warehouseValueUsd === null ? null : roundMoney(warehouseValueUsd),
      totalWarehouseUnits,
      activeStoresCount: stores.length,
      pendingTransfersCount: transfersPending,
      openCashSessions: openSessions,
      lowStockCount: lowStockAlerts.length,
      stockoutCount: lowStockAlerts.filter((a) => a.quantity <= 0).length,
    };

    const enc = rates.find((r) => r.rateType === ExchangeRateType.ENCAISSEMENT);
    const dec = rates.find((r) => r.rateType === ExchangeRateType.DECAISSEMENT);

    const recentSales: DashboardRecentSale[] = recentSalesRows.map((sale) => {
      const primary = sale.payments[0] ?? null;
      return {
        id: sale.id,
        saleNumber: sale.number,
        currency: sale.currency,
        paymentMethod: primary?.method ?? null,
        totalUsd: Number(sale.total),
        paidAmount: primary ? Number(primary.amount) : Number(sale.total),
        completedAt: sale.completedAt.toISOString(),
      };
    });

    const recentTransfers: DashboardRecentTransfer[] = recentTransferRows.map((row) => ({
      id: row.id,
      transferNumber: row.reference,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      storeName: row.store.name,
    }));

    const todayExpenses: DashboardTodayExpenses = {
      summary: todayExpensesRaw.summary,
      items: todayExpensesRaw.items.map((row) => ({
        id: row.id,
        reference: row.reference,
        status: row.status,
        category: row.category,
        amount: row.amount,
        currency: row.currency,
        amountUsdEquivalent: row.amountUsdEquivalent,
        spentAt: row.spentAt,
        locationName: row.store?.name ?? row.warehouse?.name ?? "—",
        fromCashDrawer: row.fromCashDrawer,
        createdByName: row.createdByName,
      })),
    };

    return {
      kpis,
      exchangeRate: {
        encaissementRate: enc ? Number(enc.rate) : null,
        decaissementRate: dec ? Number(dec.rate) : null,
      },
      salesByStore,
      lowStockAlerts: lowStockAlerts.slice(0, 12),
      recentSales,
      recentTransfers,
      todayExpenses,
    };
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

  private async buildTransferScope(actor: AuthUser, isGlobalScope: boolean): Promise<Prisma.TransferWhereInput> {
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
  ): Promise<Prisma.StockLevelWhereInput> {
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

  private async buildExpenseScope(actor: AuthUser, isGlobalScope: boolean): Promise<Prisma.ExpenseWhereInput> {
    if (isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      return {};
    }
    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: storeIds } };
  }

  private async countOpenCashSessions(actor: AuthUser, isGlobalScope: boolean): Promise<number> {
    const registerWhere: Prisma.CashRegisterWhereInput = { status: ReferentialStatus.ACTIVE };
    if (!isGlobalScope && actor.role.code !== "WAREHOUSE_MANAGER") {
      const storeIds = actor.stores.map((s) => s.id);
      if (storeIds.length === 0) {
        return 0;
      }
      registerWhere.storeId = { in: storeIds };
    }

    const registers = await this.prisma.cashRegister.findMany({
      where: registerWhere,
      select: { id: true },
    });
    if (registers.length === 0) {
      return 0;
    }

    return this.prisma.cashSession.count({
      where: {
        status: CashSessionStatus.OPEN,
        cashRegisterId: { in: registers.map((r) => r.id) },
      },
    });
  }
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