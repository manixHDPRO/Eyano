import { HttpStatus, Injectable } from "@nestjs/common";
import {
  CashSessionStatus,
  CurrencyCode,
  DocumentSequenceCode,
  Prisma,
  PaymentMethod,
  ProductStatus,
  ReferentialStatus,
  SaleStatus,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { computeDiscountAmount, computeFinalPrice, moneyString } from "../../common/money";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import { DocumentSequenceService } from "../../common/sequences/document-sequence.service";
import type { AuthUser } from "../../common/types/auth-user";
import { isPrismaUniqueViolation } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PaymentsService } from "../payments/payments.service";
import { STOCK_MOVEMENTS_ERROR } from "../stock-movements/stock-movements.constants";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import type { CreateSaleDto } from "./dto/create-sale.dto";
import type { ListSalesQueryDto } from "./dto/list-sales.query.dto";
import type { VoidSaleDto } from "./dto/void-sale.dto";
import { assertIdempotencyKeyFormat, hashIdempotencyKey } from "./sales-idempotency";
import { SALES_AUDIT, SALES_ERROR } from "./sales.constants";

type PrismaTx = Prisma.TransactionClient;

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

export type SaleDetail = {
  id: string;
  number: string;
  status: SaleStatus;
  storeId: string;
  cashSessionId: string;
  currency: CurrencyCode;
  subtotal: number;
  discountTotal: number;
  total: number;
  completedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  cashier: { id: string; firstName: string; lastName: string };
  store: { id: string; code: string; name: string; city: string | null; receiptHeader: string | null; receiptFooter: string | null };
  items: SaleLineDetail[];
  idempotentReplay: boolean;
  payments: SalePaymentDetail[];
};

export type SaleListItem = {
  id: string;
  number: string;
  status: SaleStatus;
  total: number;
  currency: CurrencyCode;
  completedAt: string;
  store: { id: string; code: string; name: string };
  cashierName: string;
  lineCount: number;
  paymentMethods: PaymentMethod[];
};

export type SalePaymentDetail = {
  id: string;
  method: PaymentMethod;
  currency: CurrencyCode;
  amount: number;
  amountUsd: number;
  rateSnapshot: number | null;
  providerReference: string | null;
  paidAt: string;
};

const saleInclude = {
  items: { orderBy: { referenceSnapshot: "asc" as const } },
  payments: { orderBy: { paidAt: "asc" as const } },
  cashier: { select: { id: true, firstName: true, lastName: true } },
  store: { select: { id: true, code: true, name: true, city: true, receiptHeader: true, receiptFooter: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogsService,
    private readonly sequences: DocumentSequenceService,
    private readonly stockMovements: StockMovementsService,
    private readonly payments: PaymentsService,
  ) {}

  async create(
    actor: AuthUser,
    dto: CreateSaleDto,
    rawIdempotencyKey: string | undefined,
    meta: RequestMeta,
  ): Promise<SaleDetail> {
    let idempotencyKey: string;
    try {
      idempotencyKey = assertIdempotencyKeyFormat(rawIdempotencyKey);
    } catch {
      throw idempotencyRequired();
    }
    const keyHash = hashIdempotencyKey(idempotencyKey);

    const existing = await this.prisma.saleIdempotencyKey.findUnique({
      where: { keyHash },
      include: { sale: { include: saleInclude } },
    });
    if (existing?.sale) {
      return { ...toDetail(existing.sale), idempotentReplay: true };
    }

    this.assertDistinctLines(dto);

    try {
      const sale = await this.prisma.$transaction(async (tx) => {
        const replay = await tx.saleIdempotencyKey.findUnique({
          where: { keyHash },
          include: { sale: { include: saleInclude } },
        });
        if (replay?.sale) {
          return { row: replay.sale, replay: true };
        }

        const session = await tx.cashSession.findUnique({
          where: { id: dto.cashSessionId },
          include: { cashRegister: { include: { store: true } } },
        });
        if (!session || session.status !== CashSessionStatus.OPEN) {
          throw sessionNotOpen();
        }
        const storeId = session.cashRegister.storeId;
        if (session.cashRegister.status !== ReferentialStatus.ACTIVE) {
          throw sessionNotOpen();
        }
        if (session.cashRegister.store.status !== ReferentialStatus.ACTIVE) {
          throw sessionNotOpen();
        }
        this.assertStoreAccess(actor, storeId);

        const preparedLines = await this.resolveLines(tx, dto, storeId);
        await this.assertStockForSale(tx, storeId, preparedLines);
        const subtotal = preparedLines.reduce((sum, line) => sum + Number(line.lineSubtotal), 0);
        const discountTotal = preparedLines.reduce((sum, line) => sum + Number(line.lineDiscountTotal), 0);
        const total = preparedLines.reduce((sum, line) => sum + Number(line.lineTotal), 0);
        const saleTotal = moneyString(total);

        const encaissement = await this.payments.loadOpenEncaissementRate(tx);
        const paymentLines = this.payments.resolvePaymentLines(dto.payments, encaissement);
        this.payments.assertBalanced(saleTotal, paymentLines);

        const saleNumber = await this.sequences.nextReference(DocumentSequenceCode.SALE, tx);
        const created = await tx.sale.create({
          data: {
            number: saleNumber,
            storeId,
            cashSessionId: session.id,
            cashierId: actor.id,
            status: SaleStatus.COMPLETED,
            currency: CurrencyCode.USD,
            subtotal: moneyString(subtotal),
            discountTotal: moneyString(discountTotal),
            total: saleTotal,
          },
        });

        await this.payments.persist(tx, created.id, paymentLines);

        const primaryPayment = paymentLines[0];
        const stockNote =
          primaryPayment != null
            ? `Vente caisse ${paymentMethodLabel(primaryPayment.method)} (${primaryPayment.currency})`
            : null;

        for (const line of preparedLines) {
          await tx.saleItem.create({
            data: {
              saleId: created.id,
              productId: line.productId,
              referenceSnapshot: line.reference,
              nameSnapshot: line.name,
              barcodeSnapshot: line.barcode,
              quantity: line.quantity,
              officialUnitPrice: line.officialUnitPrice,
              discountPercent: line.discountPercent,
              discountAmount: line.unitDiscountAmount,
              finalUnitPrice: line.finalUnitPrice,
              lineTotal: line.lineTotal,
              purchasePriceSnapshot: line.purchasePriceSnapshot,
            },
          });
          await this.stockMovements.recordSale(tx, {
            productId: line.productId,
            storeId,
            quantity: line.quantity,
            saleId: created.id,
            createdById: actor.id,
            note: stockNote,
          });
        }

        await tx.saleIdempotencyKey.create({
          data: {
            keyHash,
            saleId: created.id,
            createdById: actor.id,
          },
        });

        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.SALE_COMPLETED,
            entityType: AUDIT_ENTITY.SALE,
            entityId: created.id,
            storeId,
            oldValue: null,
            newValue: {
              audit: SALES_AUDIT.COMPLETED,
              number: saleNumber,
              total: saleTotal,
              itemCount: preparedLines.length,
              paymentCount: paymentLines.length,
            },
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );

        const full = await tx.sale.findUniqueOrThrow({
          where: { id: created.id },
          include: saleInclude,
        });
        return { row: full, replay: false };
      });

      return { ...toDetail(sale.row), idempotentReplay: sale.replay };
    } catch (error) {
      if (error instanceof ApiException) {
        if (error.code === STOCK_MOVEMENTS_ERROR.INSUFFICIENT_STOCK) {
          throw error;
        }
        throw error;
      }
      if (isPrismaUniqueViolation(error)) {
        const replay = await this.prisma.saleIdempotencyKey.findUnique({
          where: { keyHash },
          include: { sale: { include: saleInclude } },
        });
        if (replay?.sale) {
          return { ...toDetail(replay.sale), idempotentReplay: true };
        }
      }
      throw error;
    }
  }

  async void(actor: AuthUser, saleId: string, dto: VoidSaleDto, meta: RequestMeta): Promise<SaleDetail> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true, store: true },
      });
      if (!sale) {
        throw saleNotFound();
      }
      if (sale.status === SaleStatus.VOIDED) {
        throw alreadyVoided();
      }
      this.assertStoreAccess(actor, sale.storeId);

      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.VOIDED,
          voidedAt: new Date(),
          voidedById: actor.id,
          voidReason: dto.reason.trim(),
        },
      });

      for (const line of sale.items) {
        await this.stockMovements.recordSaleReversal(tx, {
          productId: line.productId,
          storeId: sale.storeId,
          quantity: line.quantity,
          saleId: sale.id,
          createdById: actor.id,
          note: dto.reason.trim(),
        });
      }

      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.SALE_VOIDED,
          entityType: AUDIT_ENTITY.SALE,
          entityId: sale.id,
          storeId: sale.storeId,
          oldValue: { status: SaleStatus.COMPLETED, number: sale.number },
          newValue: { audit: SALES_AUDIT.VOIDED, reason: dto.reason.trim() },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );

      return tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: saleInclude,
      });
    });

    return { ...toDetail(updated), idempotentReplay: false };
  }

  async list(actor: AuthUser, query: ListSalesQueryDto) {
    const scope = this.buildListScope(actor, query.storeId);
    const where: Prisma.SaleWhereInput = { ...scope };
    if (query.status) {
      where.status = query.status;
    }
    if (query.cashSessionId) {
      where.cashSessionId = query.cashSessionId;
    }
    const search = query.search?.trim();
    if (search) {
      where.number = { contains: search, mode: "insensitive" };
    }

    const completedFrom = query.completedFrom ? new Date(query.completedFrom) : null;
    const completedTo = query.completedTo ? new Date(query.completedTo) : null;
    if (completedFrom || completedTo) {
      where.completedAt = {};
      if (completedFrom && !Number.isNaN(completedFrom.getTime())) {
        where.completedAt.gte = completedFrom;
      }
      if (completedTo && !Number.isNaN(completedTo.getTime())) {
        where.completedAt.lte = completedTo;
      }
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ completedAt: "desc" }],
        include: {
          store: { select: { id: true, code: true, name: true } },
          cashier: { select: { firstName: true, lastName: true } },
          items: { select: { id: true } },
          payments: { select: { method: true, currency: true, amount: true, providerReference: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        number: row.number,
        status: row.status,
        total: Number(row.total),
        currency: row.currency,
        completedAt: row.completedAt.toISOString(),
        store: row.store,
        cashierName: `${row.cashier.firstName} ${row.cashier.lastName}`.trim(),
        lineCount: row.items.length,
        paymentMethods: [...new Set(row.payments.map((payment) => payment.method))],
        primaryPayment: row.payments[0]
          ? {
              method: row.payments[0].method,
              currency: row.payments[0].currency,
              amount: Number(row.payments[0].amount),
              providerReference: row.payments[0].providerReference,
            }
          : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async summary(actor: AuthUser) {
    const scope = this.buildListScope(actor, undefined);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const [todayCount, todayTotal, voided] = await Promise.all([
      this.prisma.sale.count({ where: { ...scope, completedAt: { gte: since }, status: SaleStatus.COMPLETED } }),
      this.prisma.sale.aggregate({
        where: { ...scope, completedAt: { gte: since }, status: SaleStatus.COMPLETED },
        _sum: { total: true },
      }),
      this.prisma.sale.count({ where: { ...scope, status: SaleStatus.VOIDED } }),
    ]);
    return {
      todayCount,
      todayTotalUsd: Number(todayTotal._sum.total ?? 0),
      voidedCount: voided,
    };
  }

  async findOne(actor: AuthUser, saleId: string): Promise<SaleDetail> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: saleInclude,
    });
    if (!sale) {
      throw saleNotFound();
    }
    this.assertStoreAccess(actor, sale.storeId);
    return { ...toDetail(sale), idempotentReplay: false };
  }

  private assertDistinctLines(dto: CreateSaleDto): void {
    const seen = new Set<string>();
    for (const line of dto.items) {
      if (seen.has(line.productId)) {
        throw duplicateLine();
      }
      seen.add(line.productId);
    }
  }

  private async assertStockForSale(
    tx: PrismaTx,
    storeId: string,
    lines: { productId: string; quantity: number }[],
  ): Promise<void> {
    for (const line of lines) {
      const level = await this.stockMovements.lockLevelForUpdate(tx, line.productId, null, storeId);
      const available = level?.quantityOnHand ?? 0;
      if (available <= 0 || available < line.quantity) {
        throw saleInsufficientStock();
      }
    }
  }

  private async resolveLines(tx: PrismaTx, dto: CreateSaleDto, storeId: string) {
    const lines: ResolvedLine[] = [];
    for (const item of dto.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { barcode: { select: { code: true } } },
      });
      if (!product) {
        throw productNotFound();
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw productNotActive();
      }

      const authorization = await tx.productStore.findUnique({
        where: { productId_storeId: { productId: product.id, storeId } },
      });
      if (!authorization?.isAuthorized) {
        throw productNotAuthorized();
      }

      const official = Number(product.officialPrice);
      const discountPct = Number(product.discountPercent);
      const finalUnitStr = computeFinalPrice(official, discountPct);
      const unitDiscountStr = computeDiscountAmount(official, discountPct);
      const finalUnit = Number(finalUnitStr);
      const unitDiscount = Number(unitDiscountStr);
      const lineSubtotal = Number(moneyString(official * item.quantity));
      const lineDiscountTotal = Number(moneyString(unitDiscount * item.quantity));
      const lineTotal = Number(moneyString(finalUnit * item.quantity));

      lines.push({
        productId: product.id,
        reference: product.reference,
        name: product.name,
        barcode: product.barcode?.code ?? null,
        quantity: item.quantity,
        officialUnitPrice: official.toFixed(2),
        discountPercent: moneyString(discountPct, 2),
        unitDiscountAmount: unitDiscountStr,
        finalUnitPrice: finalUnitStr,
        purchasePriceSnapshot: moneyString(Number(product.purchasePrice)),
        lineSubtotal: moneyString(lineSubtotal),
        lineDiscountTotal: moneyString(lineDiscountTotal),
        lineTotal: moneyString(lineTotal),
      });
    }
    return lines;
  }

  private buildListScope(actor: AuthUser, storeId?: string): Prisma.SaleWhereInput {
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

  private assertStoreAccess(actor: AuthUser, storeId: string): void {
    const context = {
      roleCode: actor.role.code,
      permissions: actor.permissions,
      storeIds: actor.stores.map((s) => s.id),
      stores: actor.stores,
      isGlobalScope: this.access.isGlobalRole(actor.role.code),
    };
    if (!this.access.canAccessStore(context, storeId)) {
      throw forbiddenStore();
    }
  }
}

type ResolvedLine = {
  productId: string;
  reference: string;
  name: string;
  barcode: string | null;
  quantity: number;
  officialUnitPrice: string;
  discountPercent: string;
  unitDiscountAmount: string;
  finalUnitPrice: string;
  purchasePriceSnapshot: string;
  lineSubtotal: string;
  lineDiscountTotal: string;
  lineTotal: string;
};

function toDetail(row: Prisma.SaleGetPayload<{ include: typeof saleInclude }>): Omit<SaleDetail, "idempotentReplay"> {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    storeId: row.storeId,
    cashSessionId: row.cashSessionId,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discountTotal),
    total: Number(row.total),
    completedAt: row.completedAt.toISOString(),
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason,
    cashier: row.cashier,
    store: row.store,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      reference: item.referenceSnapshot,
      name: item.nameSnapshot,
      barcode: item.barcodeSnapshot,
      quantity: item.quantity,
      officialUnitPrice: Number(item.officialUnitPrice),
      discountPercent: Number(item.discountPercent),
      discountAmount: Number(item.discountAmount),
      finalUnitPrice: Number(item.finalUnitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      currency: payment.currency,
      amount: Number(payment.amount),
      amountUsd: Number(payment.amountUsd),
      rateSnapshot: payment.rateSnapshot ? Number(payment.rateSnapshot) : null,
      providerReference: payment.providerReference,
      paidAt: payment.paidAt.toISOString(),
    })),
  };
}

function idempotencyRequired(): ApiException {
  return new ApiException(
    SALES_ERROR.IDEMPOTENCY_REQUIRED,
    "L’en-tête Idempotency-Key est obligatoire.",
    HttpStatus.BAD_REQUEST,
  );
}

function sessionNotOpen(): ApiException {
  return new ApiException(
    SALES_ERROR.SESSION_NOT_OPEN,
    "Aucune session de caisse ouverte valide pour cette boutique.",
    HttpStatus.CONFLICT,
  );
}

function forbiddenStore(): ApiException {
  return new ApiException(SALES_ERROR.FORBIDDEN_STORE, "Boutique hors de votre périmètre.", HttpStatus.FORBIDDEN);
}

function productNotFound(): ApiException {
  return new ApiException(SALES_ERROR.PRODUCT_NOT_FOUND, "Produit introuvable.", HttpStatus.BAD_REQUEST);
}

function productNotActive(): ApiException {
  return new ApiException(SALES_ERROR.PRODUCT_NOT_ACTIVE, "Ce produit n’est pas vendable.", HttpStatus.CONFLICT);
}

function productNotAuthorized(): ApiException {
  return new ApiException(
    SALES_ERROR.PRODUCT_NOT_AUTHORIZED,
    "Ce produit n'est pas autorisé à la vente dans cette boutique.",
    HttpStatus.CONFLICT,
  );
}

function saleInsufficientStock(): ApiException {
  return new ApiException(
    STOCK_MOVEMENTS_ERROR.INSUFFICIENT_STOCK,
    "Stock insuffisant : quantité disponible indisponible pour cette vente.",
    HttpStatus.CONFLICT,
  );
}

function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case PaymentMethod.CASH:
      return "Espèces";
    case PaymentMethod.MPESA:
      return "M-Pesa";
    case PaymentMethod.ORANGE_MONEY:
      return "Orange Money";
    case PaymentMethod.AIRTEL_MONEY:
      return "Airtel Money";
    default: {
      const exhaustive: never = method;
      return exhaustive;
    }
  }
}

function duplicateLine(): ApiException {
  return new ApiException(SALES_ERROR.DUPLICATE_LINE, "Regroupez les quantités par produit.", HttpStatus.BAD_REQUEST);
}

function saleNotFound(): ApiException {
  return new ApiException(SALES_ERROR.SALE_NOT_FOUND, "Vente introuvable.", HttpStatus.NOT_FOUND);
}

function alreadyVoided(): ApiException {
  return new ApiException(SALES_ERROR.SALE_ALREADY_VOIDED, "Cette vente est déjà annulée.", HttpStatus.CONFLICT);
}