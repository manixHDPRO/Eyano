import { Injectable } from "@nestjs/common";
import {
  CurrencyCode,
  PaymentMethod,
  Prisma,
  SaleStatus,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListPaymentsQueryDto } from "./dto/list-payments.query.dto";
import { MOBILE_MONEY_METHODS } from "./payments.constants";

export type PaymentListItem = {
  id: string;
  paidAt: string;
  method: PaymentMethod;
  currency: CurrencyCode;
  amount: number;
  amountUsd: number;
  rateSnapshot: number | null;
  providerReference: string | null;
  sale: {
    id: string;
    number: string;
    status: SaleStatus;
    total: number;
    completedAt: string;
  };
  store: { id: string; code: string; name: string };
  cashierName: string;
};

export type PaymentsSummary = {
  todayLineCount: number;
  todayAmountUsd: number;
  todayCashUsd: number;
  todayMobileUsd: number;
  todayCdfCollected: number;
};

const paymentInclude = {
  sale: {
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      completedAt: true,
      store: { select: { id: true, code: true, name: true } },
      cashier: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(actor: AuthUser, query: ListPaymentsQueryDto) {
    const where = this.buildWhere(actor, query);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ paidAt: "desc" }],
        include: paymentInclude,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: rows.map((row) => toListItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async summary(actor: AuthUser, storeId?: string): Promise<PaymentsSummary> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const where = this.buildWhere(actor, {
      page: 1,
      pageSize: 1,
      storeId,
      saleStatus: SaleStatus.COMPLETED,
      paidFrom: since.toISOString(),
    });

    const [lineCount, usdAgg, cashAgg, mobileRows, cdfAgg] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({ where, _sum: { amountUsd: true } }),
      this.prisma.payment.aggregate({
        where: { ...where, method: PaymentMethod.CASH },
        _sum: { amountUsd: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...where,
          method: { in: [...MOBILE_MONEY_METHODS] },
        },
        _sum: { amountUsd: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, currency: CurrencyCode.CDF },
        _sum: { amount: true },
      }),
    ]);

    return {
      todayLineCount: lineCount,
      todayAmountUsd: Number(usdAgg._sum.amountUsd ?? 0),
      todayCashUsd: Number(cashAgg._sum.amountUsd ?? 0),
      todayMobileUsd: Number(mobileRows._sum.amountUsd ?? 0),
      todayCdfCollected: Number(cdfAgg._sum.amount ?? 0),
    };
  }

  private buildWhere(actor: AuthUser, query: ListPaymentsQueryDto): Prisma.PaymentWhereInput {
    const saleScope = this.buildSaleScope(actor, query.storeId);
    const saleWhere: Prisma.SaleWhereInput = { ...saleScope };

    if (query.saleStatus === "ALL") {
      // pas de filtre statut vente
    } else if (query.saleStatus) {
      saleWhere.status = query.saleStatus;
    } else {
      saleWhere.status = SaleStatus.COMPLETED;
    }

    const and: Prisma.PaymentWhereInput[] = [{ sale: saleWhere }];

    if (query.method) {
      and.push({ method: query.method });
    }
    if (query.currency) {
      and.push({ currency: query.currency });
    }

    if (query.paidFrom || query.paidTo) {
      const paidAt: Prisma.DateTimeFilter = {};
      if (query.paidFrom) {
        paidAt.gte = new Date(query.paidFrom);
      }
      if (query.paidTo) {
        paidAt.lte = new Date(query.paidTo);
      }
      and.push({ paidAt });
    }

    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { providerReference: { contains: search, mode: "insensitive" }, sale: saleWhere },
          { sale: { ...saleWhere, number: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    return { AND: and };
  }

  private buildSaleScope(actor: AuthUser, storeId?: string): Prisma.SaleWhereInput {
    const context = {
      roleCode: actor.role.code,
      permissions: actor.permissions,
      storeIds: actor.stores.map((s) => s.id),
      stores: actor.stores,
      isGlobalScope: this.access.isGlobalRole(actor.role.code),
    };
    if (storeId) {
      if (!this.access.canAccessStore(context, storeId)) {
        return { id: { in: [] } };
      }
      return { storeId };
    }
    if (context.isGlobalScope) {
      return {};
    }
    if (context.storeIds.length === 0) {
      return { id: { in: [] } };
    }
    return { storeId: { in: context.storeIds } };
  }
}

function toListItem(row: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>): PaymentListItem {
  const sale = row.sale;
  return {
    id: row.id,
    paidAt: row.paidAt.toISOString(),
    method: row.method,
    currency: row.currency,
    amount: Number(row.amount),
    amountUsd: Number(row.amountUsd),
    rateSnapshot: row.rateSnapshot ? Number(row.rateSnapshot) : null,
    providerReference: row.providerReference,
    sale: {
      id: sale.id,
      number: sale.number,
      status: sale.status,
      total: Number(sale.total),
      completedAt: sale.completedAt.toISOString(),
    },
    store: sale.store,
    cashierName: `${sale.cashier.firstName} ${sale.cashier.lastName}`.trim(),
  };
}