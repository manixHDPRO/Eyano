import { Injectable } from "@nestjs/common";
import { NotificationSeverity, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SETTING_NOTIFY_INVENTORY_VARIANCE } from "./inventory.constants";

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class InventoryNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyVariance(
    client: DbClient,
    input: {
      sessionId: string;
      reference: string;
      locationLabel: string;
      storeId: string | null;
      varianceLines: number;
      varianceUnits: number;
    },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_INVENTORY_VARIANCE))) {
      return;
    }
    if (input.varianceLines === 0) {
      return;
    }
    await client.notification.create({
      data: {
        type: NotificationType.INVENTORY_VARIANCE,
        severity: NotificationSeverity.WARNING,
        title: `Écarts d'inventaire — ${input.reference}`,
        body: `Session ${input.reference} (${input.locationLabel}) : ${input.varianceLines} ligne(s), ${input.varianceUnits} unité(s) d'écart après validation.`,
        entityType: "InventorySession",
        entityId: input.sessionId,
        storeId: input.storeId,
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