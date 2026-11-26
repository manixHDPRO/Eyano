import { Injectable } from "@nestjs/common";
import { NotificationSeverity, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SETTING_NOTIFY_DISCOUNT, SETTING_NOTIFY_PRICE } from "./pricing.constants";

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PricingNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyPriceChanged(
    client: DbClient,
    input: { productId: string; reference: string; name: string },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_PRICE))) {
      return;
    }
    await client.notification.create({
      data: {
        type: NotificationType.PRICE_CHANGED,
        severity: NotificationSeverity.INFO,
        title: `Prix — ${input.reference}`,
        body: `Le tarif de « ${input.name} » a été modifié.`,
        entityType: "Product",
        entityId: input.productId,
      },
    });
  }

  async notifyDiscountChanged(
    client: DbClient,
    input: { productId: string; reference: string; name: string },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_DISCOUNT))) {
      return;
    }
    await client.notification.create({
      data: {
        type: NotificationType.DISCOUNT_CHANGED,
        severity: NotificationSeverity.INFO,
        title: `Remise — ${input.reference}`,
        body: `La remise de « ${input.name} » a été modifiée.`,
        entityType: "Product",
        entityId: input.productId,
      },
    });
  }
}

async function isEnabled(client: DbClient, key: string): Promise<boolean> {
  const row = await client.appSetting.findUnique({ where: { key } });
  if (!row) {
    return false;
  }
  return row.value === true;
}