import { HttpStatus, Injectable } from "@nestjs/common";
import {
  CashSessionStatus,
  PaymentMethod,
  Prisma,
  ProductStatus,
  ReferentialStatus,
  SaleStatus,
} from "@prisma/client";
import { computeCashSessionLedger } from "../../common/cash-session/cash-session-ledger.util";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { PosDailySalesReportQueryDto } from "./dto/pos-daily-sales-report.query.dto";
import { POS_ERROR } from "./pos.constants";

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
  status: SaleStatus;
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

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async catalog(actor: AuthUser, storeId: string, search?: string): Promise<PosCatalog> {
    this.assertStoreAccess(actor, storeId);

    const term = search?.trim();
    const filters: Prisma.ProductWhereInput[] = [{ status: ProductStatus.ACTIVE }];

    if (actor.role.code === "CASHIER") {
      filters.push({
        productStores: {
          some: { storeId, isAuthorized: true },
        },
      });
    }

    if (term) {
      filters.push({
        OR: [
          { reference: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          { brand: { contains: term, mode: "insensitive" } },
          { barcode: { code: { contains: term, mode: "insensitive" } } },
        ],
      });
    }

    const products = await this.prisma.product.findMany({
      where: { AND: filters },
      orderBy: [{ name: "asc" }, { reference: "asc" }],
      take: 240,
      select: {
        id: true,
        reference: true,
        name: true,
        brand: true,
        photoPath: true,
        officialPrice: true,
        discountPercent: true,
        finalPrice: true,
        barcode: { select: { code: true } },
        productStores: { where: { storeId }, select: { isAuthorized: true } },
        stockLevels: {
          where: { storeId, warehouseId: null },
          select: { quantityOnHand: true, quantityReserved: true },
        },
      },
    });

    return {
      storeId,
      items: products.map((product) => {
        const level = product.stockLevels[0];
        const onHand = level?.quantityOnHand ?? 0;
        const reserved = level?.quantityReserved ?? 0;
        return {
          id: product.id,
          reference: product.reference,
          barcode: product.barcode?.code ?? null,
          name: product.name,
          brand: product.brand,
          photoUrl: toPublicPhotoUrl(product.photoPath),
          isAuthorized: product.productStores[0]?.isAuthorized ?? false,
          officialPrice: Number(product.officialPrice),
          discountPercent: Number(product.discountPercent),
          finalPrice: Number(product.finalPrice),
          stock: Math.max(0, onHand - reserved),
        };
      }),
    };
  }

  async dailySalesReport(actor: AuthUser, query: PosDailySalesReportQueryDto): Promise<PosDailySalesReport> {
    this.assertStoreAccess(actor, query.storeId);

    const register = await this.prisma.cashRegister.findUnique({
      where: { id: query.cashRegisterId },
      select: { id: true, code: true, name: true, storeId: true, status: true },
    });
    if (!register || register.status !== ReferentialStatus.ACTIVE || register.storeId !== query.storeId) {
      throw registerForbidden();
    }

    const day = parseReportDay(query.date);
    const { start, end, reportDate } = dayBounds(day);

    const sales = await this.prisma.sale.findMany({
      where: {
        storeId: query.storeId,
        completedAt: { gte: start, lte: end },
        cashSession: { cashRegisterId: query.cashRegisterId },
      },
      include: {
        payments: true,
        cashier: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ completedAt: "asc" }],
    });

    const store = await this.prisma.store.findUnique({
      where: { id: query.storeId },
      select: { id: true, code: true, name: true, city: true, receiptHeader: true },
    });
    if (!store) {
      throw registerForbidden();
    }

    const completed = sales.filter((row) => row.status === SaleStatus.COMPLETED);
    const voided = sales.filter((row) => row.status === SaleStatus.VOIDED);
    const grossUsd = completed.reduce((sum, row) => sum + Number(row.total), 0);

    const paymentMap = new Map<PaymentMethod, PosDailySalesReportPaymentRow>();
    for (const method of Object.values(PaymentMethod)) {
      paymentMap.set(method, { method, paymentLines: 0, amountUsd: 0, cashCdfCollected: 0 });
    }
    for (const sale of completed) {
      for (const payment of sale.payments) {
        const row = paymentMap.get(payment.method)!;
        row.paymentLines += 1;
        row.amountUsd += Number(payment.amountUsd);
        if (payment.method === PaymentMethod.CASH && payment.currency === "CDF") {
          row.cashCdfCollected += Number(payment.amount);
        }
      }
    }
    const paymentBreakdown = [...paymentMap.values()].filter(
      (row) => row.paymentLines > 0 || row.amountUsd > 0.001,
    );

    const cashierMap = new Map<string, PosDailySalesReportCashierRow>();
    for (const sale of completed) {
      const name = `${sale.cashier.firstName} ${sale.cashier.lastName}`.trim();
      const existing = cashierMap.get(name) ?? { name, sales: 0, totalUsd: 0 };
      existing.sales += 1;
      existing.totalUsd += Number(sale.total);
      cashierMap.set(name, existing);
    }
    const cashierBreakdown = [...cashierMap.values()].sort((a, b) => b.totalUsd - a.totalUsd);

    const openSessionRow = await this.prisma.cashSession.findFirst({
      where: { cashRegisterId: query.cashRegisterId, status: CashSessionStatus.OPEN },
      include: { openedBy: { select: { firstName: true, lastName: true } } },
    });

    let openSession: PosDailySalesReportOpenSession | null = null;
    if (openSessionRow) {
      const ledger = await computeCashSessionLedger(
        this.prisma,
        openSessionRow.id,
        Number(openSessionRow.openingFloatUsd),
        Number(openSessionRow.openingFloatCdf),
      );
      const salesOnSession = await this.prisma.sale.count({
        where: { cashSessionId: openSessionRow.id, status: SaleStatus.COMPLETED },
      });
      openSession = {
        id: openSessionRow.id,
        openedAt: openSessionRow.openedAt.toISOString(),
        openedByName: `${openSessionRow.openedBy.firstName} ${openSessionRow.openedBy.lastName}`.trim(),
        openingFloatUsd: Number(openSessionRow.openingFloatUsd),
        openingFloatCdf: Number(openSessionRow.openingFloatCdf),
        salesOnSession,
        ...ledger,
      };
    }

    return {
      reportDate,
      generatedAt: new Date().toISOString(),
      store,
      cashRegister: { id: register.id, code: register.code, name: register.name },
      openSession,
      totals: {
        completedSales: completed.length,
        voidedSales: voided.length,
        grossUsd,
      },
      paymentBreakdown,
      cashierBreakdown,
      tickets: sales.map((sale) => ({
        number: sale.number,
        completedAt: sale.completedAt.toISOString(),
        cashierName: `${sale.cashier.firstName} ${sale.cashier.lastName}`.trim(),
        totalUsd: Number(sale.total),
        status: sale.status,
      })),
    };
  }

  async workspace(actor: AuthUser): Promise<PosWorkspace> {
    const storeIds = this.resolveStoreScope(actor);
    if (storeIds !== null && storeIds.length === 0) {
      throw noStore();
    }

    const registers = await this.prisma.cashRegister.findMany({
      where: {
        ...(storeIds ? { storeId: { in: storeIds } } : {}),
        status: ReferentialStatus.ACTIVE,
        store: { status: ReferentialStatus.ACTIVE },
      },
      orderBy: [{ store: { name: "asc" } }, { isDefault: "desc" }, { code: "asc" }],
      include: {
        store: { select: { id: true, code: true, name: true, city: true } },
      },
    });

    const registerIds = registers.map((row) => row.id);
    const openSessions = registerIds.length
      ? await this.prisma.cashSession.findMany({
          where: { cashRegisterId: { in: registerIds }, status: CashSessionStatus.OPEN },
          include: { openedBy: { select: { firstName: true, lastName: true } } },
        })
      : [];

    const sessionByRegister = new Map(openSessions.map((row) => [row.cashRegisterId, row]));

    const primaryStoreId =
      actor.stores.find((store) => store.isPrimary)?.id ??
      actor.stores[0]?.id ??
      (storeIds && storeIds[0]) ??
      registers[0]?.store.id ??
      null;

    return {
      primaryStoreId,
      registers: registers.map((register) => {
        const session = sessionByRegister.get(register.id);
        return {
          id: register.id,
          code: register.code,
          name: register.name,
          isDefault: register.isDefault,
          store: register.store,
          openSession: session
            ? {
                id: session.id,
                openedAt: session.openedAt.toISOString(),
                openingFloatUsd: Number(session.openingFloatUsd),
                openingFloatCdf: Number(session.openingFloatCdf),
                openedByName: `${session.openedBy.firstName} ${session.openedBy.lastName}`.trim(),
              }
            : null,
        };
      }),
    };
  }

  private resolveStoreScope(actor: AuthUser): string[] | null {
    if (this.access.isGlobalRole(actor.role.code)) {
      return null;
    }
    return actor.stores.map((store) => store.id);
  }

  private assertStoreAccess(actor: AuthUser, storeId: string): void {
    const context = {
      roleCode: actor.role.code,
      permissions: actor.permissions,
      storeIds: actor.stores.map((store) => store.id),
      stores: actor.stores,
      isGlobalScope: this.access.isGlobalRole(actor.role.code),
    };
    if (!this.access.canAccessStore(context, storeId)) {
      throw new ApiException(
        POS_ERROR.STORE_FORBIDDEN,
        "Boutique hors périmètre.",
        HttpStatus.FORBIDDEN,
      );
    }
  }
}

function toPublicPhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) {
    return null;
  }
  return `/uploads/${photoPath.replace(/^\/+/, "")}`;
}

function noStore(): ApiException {
  return new ApiException(
    POS_ERROR.NO_STORE,
    "Aucune boutique affectée : impossible d’ouvrir la caisse.",
    HttpStatus.FORBIDDEN,
  );
}

function registerForbidden(): ApiException {
  return new ApiException(POS_ERROR.REGISTER_FORBIDDEN, "Caisse invalide pour cette boutique.", HttpStatus.FORBIDDEN);
}

function invalidReportDate(): ApiException {
  return new ApiException(POS_ERROR.INVALID_REPORT_DATE, "Date de rapport invalide (YYYY-MM-DD).", HttpStatus.BAD_REQUEST);
}

function parseReportDay(input?: string): Date {
  if (!input?.trim()) {
    return new Date();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) {
    throw invalidReportDate();
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw invalidReportDate();
  }
  return parsed;
}

function dayBounds(reference: Date): { start: Date; end: Date; reportDate: string } {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(reference);
  end.setHours(23, 59, 59, 999);
  const reportDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { start, end, reportDate };
}