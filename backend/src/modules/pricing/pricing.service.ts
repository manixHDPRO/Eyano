import { HttpStatus, Injectable } from "@nestjs/common";
import { ProductStatus, type Prisma } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListPricingHistoryQueryDto } from "./dto/list-pricing-history.query.dto";
import type { UpdateProductDiscountDto } from "./dto/update-product-discount.dto";
import type { UpdateProductPricesDto } from "./dto/update-product-prices.dto";
import { PRICING_ERROR } from "./pricing.constants";
import { PricingLedgerService } from "./pricing-ledger.service";

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

export type ProductPricingTimeline = {
  product: {
    id: string;
    reference: string;
    name: string;
    status: ProductStatus;
    purchasePrice: number;
    officialPrice: number;
    discountPercent: number;
    finalPrice: number;
  };
  prices: PricingHistoryPriceRow[];
  discounts: PricingHistoryDiscountRow[];
  openPriceId: string | null;
  openDiscountId: string | null;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: PricingLedgerService,
  ) {}

  async getProductTimeline(actor: AuthUser, productId: string): Promise<ProductPricingTimeline> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...catalogReadFilter(actor) },
    });
    if (!product) {
      throw notFound();
    }

    const [prices, discounts] = await Promise.all([
      this.prisma.productPrice.findMany({
        where: { productId },
        orderBy: { validFrom: "desc" },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.productDiscount.findMany({
        where: { productId },
        orderBy: { validFrom: "desc" },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const openPrice = prices.find((row) => row.validTo === null);
    const openDiscount = discounts.find((row) => row.validTo === null);

    return {
      product: {
        id: product.id,
        reference: product.reference,
        name: product.name,
        status: product.status,
        purchasePrice: Number(product.purchasePrice.toFixed(2)),
        officialPrice: Number(product.officialPrice.toFixed(2)),
        discountPercent: Number(product.discountPercent.toFixed(2)),
        finalPrice: Number(product.finalPrice.toFixed(2)),
      },
      prices: prices.map((row, index) => mapPriceRow(row, prices[index + 1])),
      discounts: discounts.map((row, index) => mapDiscountRow(row, discounts[index + 1])),
      openPriceId: openPrice?.id ?? null,
      openDiscountId: openDiscount?.id ?? null,
    };
  }

  async listRecentChanges(actor: AuthUser, query: ListPricingHistoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filters: Prisma.ProductWhereInput[] = [catalogReadFilter(actor)];
    if (query.search?.trim()) {
      const term = query.search.trim();
      filters.push({
        OR: [
          { reference: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          { brand: { contains: term, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.ProductWhereInput = { AND: filters };

    const skip = (page - 1) * pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          reference: true,
          name: true,
          status: true,
          purchasePrice: true,
          officialPrice: true,
          discountPercent: true,
          finalPrice: true,
          updatedAt: true,
          _count: {
            select: {
              productPrices: true,
              productDiscounts: true,
            },
          },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        name: row.name,
        status: row.status,
        purchasePrice: Number(row.purchasePrice.toFixed(2)),
        officialPrice: Number(row.officialPrice.toFixed(2)),
        discountPercent: Number(row.discountPercent.toFixed(2)),
        finalPrice: Number(row.finalPrice.toFixed(2)),
        priceHistoryCount: row._count.productPrices,
        discountHistoryCount: row._count.productDiscounts,
        updatedAt: row.updatedAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async updatePrices(
    actor: AuthUser,
    productId: string,
    dto: UpdateProductPricesDto,
    meta: RequestMeta,
  ): Promise<ProductPricingTimeline> {
    await this.ledger.applyTariffChange({
      actor,
      productId,
      meta,
      purchasePrice: dto.purchasePrice,
      officialPrice: dto.officialPrice,
      priceReason: dto.reason ?? null,
    });
    return this.getProductTimeline(actor, productId);
  }

  async updateDiscount(
    actor: AuthUser,
    productId: string,
    dto: UpdateProductDiscountDto,
    meta: RequestMeta,
  ): Promise<ProductPricingTimeline> {
    await this.ledger.applyTariffChange({
      actor,
      productId,
      meta,
      discountPercent: dto.percent,
      discountReason: dto.reason ?? null,
    });
    return this.getProductTimeline(actor, productId);
  }
}

type PriceWithAuthor = Prisma.ProductPriceGetPayload<{
  include: { createdBy: { select: { firstName: true; lastName: true } } };
}>;

type DiscountWithAuthor = Prisma.ProductDiscountGetPayload<{
  include: { createdBy: { select: { firstName: true; lastName: true } } };
}>;

function mapPriceRow(row: PriceWithAuthor, older?: PriceWithAuthor): PricingHistoryPriceRow {
  return {
    id: row.id,
    purchasePrice: Number(row.purchasePrice.toFixed(2)),
    officialPrice: Number(row.officialPrice.toFixed(2)),
    previousPurchasePrice: older ? Number(older.purchasePrice.toFixed(2)) : null,
    previousOfficialPrice: older ? Number(older.officialPrice.toFixed(2)) : null,
    currency: row.currency,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo?.toISOString() ?? null,
    reason: row.reason,
    createdById: row.createdById,
    createdByName: formatName(row.createdBy),
  };
}

function mapDiscountRow(row: DiscountWithAuthor, older?: DiscountWithAuthor): PricingHistoryDiscountRow {
  return {
    id: row.id,
    percent: Number(row.percent.toFixed(2)),
    previousPercent: older ? Number(older.percent.toFixed(2)) : null,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo?.toISOString() ?? null,
    reason: row.reason,
    createdById: row.createdById,
    createdByName: formatName(row.createdBy),
  };
}

function formatName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function catalogReadFilter(actor: AuthUser): Prisma.ProductWhereInput {
  if (actor.role.code !== "CASHIER") {
    return {};
  }
  const storeIds = actor.stores.map((store) => store.id);
  if (storeIds.length === 0) {
    return { id: { in: [] } };
  }
  return {
    status: ProductStatus.ACTIVE,
    productStores: {
      some: {
        isAuthorized: true,
        storeId: { in: storeIds },
      },
    },
  };
}

function notFound(): ApiException {
  return new ApiException(PRICING_ERROR.NOT_FOUND, "Produit introuvable.", HttpStatus.NOT_FOUND);
}