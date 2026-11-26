import { HttpStatus, Injectable } from "@nestjs/common";
import { CurrencyCode, Prisma, type Product } from "@prisma/client";
import { ACCESS_ERROR } from "../../common/access/access.constants";
import { computeFinalPrice, moneyString } from "../../common/money";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestMeta } from "../../common/http/request-meta";
import { PRICING_ERROR } from "./pricing.constants";
import { PricingNotificationsService } from "./pricing-notifications.service";

export type TariffSnapshot = {
  purchasePrice: string;
  officialPrice: string;
  discountPercent: string;
  finalPrice: string;
};

export type ApplyTariffOptions = {
  actor: AuthUser;
  productId: string;
  meta: RequestMeta;
  purchasePrice?: number;
  officialPrice?: number;
  discountPercent?: number;
  priceReason?: string | null;
  discountReason?: string | null;
  /** Création initiale : pas de notification prix / remise. */
  isCreation?: boolean;
  tx?: Prisma.TransactionClient;
};

@Injectable()
export class PricingLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly notifications: PricingNotificationsService,
  ) {}

  async bootstrapOpenLines(
    tx: Prisma.TransactionClient,
    input: {
      productId: string;
      actorId: string;
      purchasePrice: string;
      officialPrice: string;
      discountPercent: string;
    },
  ): Promise<void> {
    const now = new Date();
    await tx.productPrice.create({
      data: {
        productId: input.productId,
        purchasePrice: input.purchasePrice,
        officialPrice: input.officialPrice,
        currency: CurrencyCode.USD,
        validFrom: now,
        createdById: input.actorId,
      },
    });
    await tx.productDiscount.create({
      data: {
        productId: input.productId,
        percent: input.discountPercent,
        validFrom: now,
        createdById: input.actorId,
      },
    });
  }

  async applyTariffChange(options: ApplyTariffOptions): Promise<TariffSnapshot> {
    const run = async (tx: Prisma.TransactionClient) => {
      const product = await tx.product.findUnique({ where: { id: options.productId } });
      if (!product) {
        throw notFound();
      }

      const currentPurchase = product.purchasePrice.toFixed(2);
      const currentOfficial = product.officialPrice.toFixed(2);
      const currentDiscount = product.discountPercent.toFixed(2);

      const nextPurchase =
        options.purchasePrice !== undefined ? moneyString(options.purchasePrice) : currentPurchase;
      const nextOfficial =
        options.officialPrice !== undefined ? moneyString(options.officialPrice) : currentOfficial;
      const nextDiscount =
        options.discountPercent !== undefined ? moneyString(options.discountPercent) : currentDiscount;

      if (Number(nextDiscount) < 0 || Number(nextDiscount) > 100) {
        throw new ApiException(
          PRICING_ERROR.DISCOUNT_OUT_OF_RANGE,
          "La remise doit être comprise entre 0 et 100 %.",
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const priceChanged = nextPurchase !== currentPurchase || nextOfficial !== currentOfficial;
      const discountChanged = nextDiscount !== currentDiscount;

      if (!priceChanged && !discountChanged) {
        return tariffFromProduct(product);
      }

      if (priceChanged) {
        assertPermission(options.actor, "prices.update");
      }
      if (discountChanged) {
        assertPermission(options.actor, "discounts.update");
      }

      if (priceChanged) {
        await closeAndInsertPrice(tx, {
          productId: options.productId,
          actorId: options.actor.id,
          purchasePrice: nextPurchase,
          officialPrice: nextOfficial,
          reason: options.priceReason ?? null,
        });
      }

      if (discountChanged) {
        await closeAndInsertDiscount(tx, {
          productId: options.productId,
          actorId: options.actor.id,
          percent: nextDiscount,
          reason: options.discountReason ?? null,
        });
      }

      const finalPrice = computeFinalPrice(Number(nextOfficial), Number(nextDiscount));
      const updated = await tx.product.update({
        where: { id: options.productId },
        data: {
          purchasePrice: nextPurchase,
          officialPrice: nextOfficial,
          discountPercent: nextDiscount,
          finalPrice,
        },
      });

      if (priceChanged) {
        await this.audit.write(
          {
            actorId: options.actor.id,
            action: AUDIT_ACTION.PRODUCT_PRICE_UPDATED,
            entityType: AUDIT_ENTITY.PRODUCT,
            entityId: options.productId,
            oldValue: { purchasePrice: currentPurchase, officialPrice: currentOfficial },
            newValue: { purchasePrice: nextPurchase, officialPrice: nextOfficial, reason: options.priceReason ?? null },
            ip: options.meta.ip,
            userAgent: options.meta.userAgent,
          },
          tx,
        );
      }

      if (discountChanged) {
        await this.audit.write(
          {
            actorId: options.actor.id,
            action: AUDIT_ACTION.PRODUCT_DISCOUNT_UPDATED,
            entityType: AUDIT_ENTITY.PRODUCT,
            entityId: options.productId,
            oldValue: { discountPercent: currentDiscount },
            newValue: { discountPercent: nextDiscount, reason: options.discountReason ?? null },
            ip: options.meta.ip,
            userAgent: options.meta.userAgent,
          },
          tx,
        );
      }

      if (!options.isCreation) {
        if (priceChanged) {
          await this.notifications.notifyPriceChanged(tx, {
            productId: product.id,
            reference: product.reference,
            name: product.name,
          });
        }
        if (discountChanged) {
          await this.notifications.notifyDiscountChanged(tx, {
            productId: product.id,
            reference: product.reference,
            name: product.name,
          });
        }
      }

      return tariffFromProduct(updated);
    };

    if (options.tx) {
      return run(options.tx);
    }
    return this.prisma.$transaction(run);
  }

  async readOpenTariff(productId: string): Promise<TariffSnapshot | null> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return null;
    }
    const [openPrice, openDiscount] = await Promise.all([
      this.prisma.productPrice.findFirst({ where: { productId, validTo: null } }),
      this.prisma.productDiscount.findFirst({ where: { productId, validTo: null } }),
    ]);
    if (!openPrice || !openDiscount) {
      return tariffFromProduct(product);
    }
    return {
      purchasePrice: openPrice.purchasePrice.toFixed(2),
      officialPrice: openPrice.officialPrice.toFixed(2),
      discountPercent: openDiscount.percent.toFixed(2),
      finalPrice: product.finalPrice.toFixed(2),
    };
  }
}

async function closeAndInsertPrice(
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    actorId: string;
    purchasePrice: string;
    officialPrice: string;
    reason: string | null;
  },
): Promise<void> {
  const now = new Date();
  const open = await tx.productPrice.findFirst({ where: { productId: input.productId, validTo: null } });
  if (open) {
    await tx.productPrice.update({ where: { id: open.id }, data: { validTo: now } });
  }
  await tx.productPrice.create({
    data: {
      productId: input.productId,
      purchasePrice: input.purchasePrice,
      officialPrice: input.officialPrice,
      currency: CurrencyCode.USD,
      validFrom: now,
      createdById: input.actorId,
      reason: input.reason,
    },
  });
}

async function closeAndInsertDiscount(
  tx: Prisma.TransactionClient,
  input: { productId: string; actorId: string; percent: string; reason: string | null },
): Promise<void> {
  const now = new Date();
  const open = await tx.productDiscount.findFirst({ where: { productId: input.productId, validTo: null } });
  if (open) {
    await tx.productDiscount.update({ where: { id: open.id }, data: { validTo: now } });
  }
  await tx.productDiscount.create({
    data: {
      productId: input.productId,
      percent: input.percent,
      validFrom: now,
      createdById: input.actorId,
      reason: input.reason,
    },
  });
}

function tariffFromProduct(product: Product): TariffSnapshot {
  return {
    purchasePrice: product.purchasePrice.toFixed(2),
    officialPrice: product.officialPrice.toFixed(2),
    discountPercent: product.discountPercent.toFixed(2),
    finalPrice: product.finalPrice.toFixed(2),
  };
}

function assertPermission(actor: AuthUser, code: string): void {
  if (actor.permissions.includes(code)) {
    return;
  }
  throw new ApiException(ACCESS_ERROR.FORBIDDEN, "Action non autorisée.", HttpStatus.FORBIDDEN);
}

function notFound(): ApiException {
  return new ApiException(PRICING_ERROR.NOT_FOUND, "Produit introuvable.", HttpStatus.NOT_FOUND);
}