import { Injectable } from "@nestjs/common";
import { NotificationSeverity, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SETTING_NOTIFY_INTERNAL_ISSUE_PENDING } from "./internal-issues.constants";

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class InternalIssueNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyPending(
    client: DbClient,
    input: {
      issueId: string;
      reference: string;
      locationLabel: string;
      productLabel: string;
      quantity: number;
      storeId: string | null;
    },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_INTERNAL_ISSUE_PENDING))) {
      return;
    }
    const isStoreScope = Boolean(input.storeId);
    await client.notification.create({
      data: {
        type: NotificationType.INTERNAL_ISSUE_PENDING,
        severity: NotificationSeverity.INFO,
        title: isStoreScope
          ? `Sortie interne à confirmer — ${input.reference}`
          : `Sortie interne à valider — ${input.reference}`,
        body: isStoreScope
          ? `${input.quantity} × ${input.productLabel} (${input.locationLabel}) — confirmez en caisse avant validation centrale.`
          : `${input.reference} (${input.locationLabel}) : ${input.quantity} × ${input.productLabel} en attente d’approbation centrale.`,
        entityType: "InternalStockIssue",
        entityId: input.issueId,
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