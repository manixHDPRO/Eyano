import { Injectable } from "@nestjs/common";
import { NotificationSeverity, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  SETTING_NOTIFY_LOW_STOCK,
  SETTING_NOTIFY_STOCKOUT,
  SETTING_STOCK_ALERT_DEFAULT,
} from "./stock-movements.constants";

type DbClient = Prisma.TransactionClient | PrismaService;

export type StockAlertContext = {
  productId: string;
  reference: string;
  name: string;
  storeId: string | null;
  locationLabel: string;
  previousOnHand: number;
  nextOnHand: number;
  effectiveThreshold: number;
};

@Injectable()
export class StockNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateAfterMovement(client: DbClient, ctx: StockAlertContext): Promise<void> {
    const crossedLow =
      ctx.previousOnHand > ctx.effectiveThreshold && ctx.nextOnHand <= ctx.effectiveThreshold;
    const crossedStockout = ctx.previousOnHand > 0 && ctx.nextOnHand === 0;

    if (crossedLow && (await isEnabled(client, SETTING_NOTIFY_LOW_STOCK))) {
      await client.notification.create({
        data: {
          type: NotificationType.LOW_STOCK,
          severity: NotificationSeverity.WARNING,
          title: `Stock bas — ${ctx.reference}`,
          body: `« ${ctx.name} » (${ctx.locationLabel}) : ${ctx.nextOnHand} en main (seuil ${ctx.effectiveThreshold}).`,
          entityType: "Product",
          entityId: ctx.productId,
          storeId: ctx.storeId,
        },
      });
    }

    if (crossedStockout && (await isEnabled(client, SETTING_NOTIFY_STOCKOUT))) {
      await client.notification.create({
        data: {
          type: NotificationType.STOCKOUT,
          severity: NotificationSeverity.CRITICAL,
          title: `Rupture — ${ctx.reference}`,
          body: `« ${ctx.name} » (${ctx.locationLabel}) est en rupture (0 en main).`,
          entityType: "Product",
          entityId: ctx.productId,
          storeId: ctx.storeId,
        },
      });
    }
  }

  async resolveEffectiveThreshold(client: DbClient, productId: string): Promise<number> {
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { alertThreshold: true },
    });
    if (product?.alertThreshold != null) {
      return product.alertThreshold;
    }
    const setting = await client.appSetting.findUnique({ where: { key: SETTING_STOCK_ALERT_DEFAULT } });
    const fallback = typeof setting?.value === "number" ? setting.value : 100;
    return fallback;
  }
}

async function isEnabled(client: DbClient, key: string): Promise<boolean> {
  const row = await client.appSetting.findUnique({ where: { key } });
  if (!row) {
    return false;
  }
  return row.value === true;
}