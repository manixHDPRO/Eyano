import { Injectable } from "@nestjs/common";
import { NotificationSeverity, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  SETTING_NOTIFY_TRANSFER_PENDING,
  SETTING_NOTIFY_TRANSFER_RECEIVED,
  SETTING_NOTIFY_TRANSFER_SHIPPED,
} from "./transfers.constants";

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class TransferNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyPending(
    client: DbClient,
    input: { transferId: string; reference: string; storeId: string; storeName: string },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_TRANSFER_PENDING))) {
      return;
    }
    await client.notification.create({
      data: {
        type: NotificationType.TRANSFER_PENDING,
        severity: NotificationSeverity.INFO,
        title: `Transfert en attente — ${input.reference}`,
        body: `Le transfert ${input.reference} vers « ${input.storeName} » attend une validation administrative.`,
        entityType: "Transfer",
        entityId: input.transferId,
        storeId: input.storeId,
      },
    });
  }

  async notifyShipped(
    client: DbClient,
    input: {
      transferId: string;
      reference: string;
      storeId: string;
      storeName: string;
      lineCount: number;
    },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_TRANSFER_SHIPPED))) {
      return;
    }
    await client.notification.create({
      data: {
        type: NotificationType.TRANSFER_SHIPPED,
        severity: NotificationSeverity.INFO,
        title: `Transfert expédié — ${input.reference}`,
        body: `Le transfert ${input.reference} est en route vers « ${input.storeName} » (${input.lineCount} ligne(s)). La caissière doit vérifier et confirmer la réception.`,
        entityType: "Transfer",
        entityId: input.transferId,
        storeId: input.storeId,
      },
    });
  }

  async notifyReceived(
    client: DbClient,
    input: {
      transferId: string;
      reference: string;
      storeId: string;
      storeName: string;
      hasVariance: boolean;
      varianceSummary: string;
    },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_TRANSFER_RECEIVED))) {
      return;
    }
    await client.notification.create({
      data: {
        type: NotificationType.TRANSFER_RECEIVED,
        severity: input.hasVariance ? NotificationSeverity.WARNING : NotificationSeverity.INFO,
        title: input.hasVariance
          ? `Écart de transfert — ${input.reference}`
          : `Transfert réceptionné — ${input.reference}`,
        body: input.hasVariance
          ? `Réception ${input.reference} à « ${input.storeName} » : ${input.varianceSummary}. Le manquant reste sorti de l'entrepôt — aucun retour silencieux.`
          : `Le transfert ${input.reference} a été réceptionné sans écart à « ${input.storeName} ».`,
        entityType: "Transfer",
        entityId: input.transferId,
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
