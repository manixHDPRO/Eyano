import { Injectable } from "@nestjs/common";
import { NotificationSeverity, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SETTING_NOTIFY_EXPENSE_DRAWER_PENDING } from "./expenses.constants";

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ExpenseNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyDrawerPending(
    client: DbClient,
    input: {
      expenseId: string;
      reference: string;
      storeId: string;
      registerLabel: string;
      amountLabel: string;
      createdByName: string;
    },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_EXPENSE_DRAWER_PENDING))) {
      return;
    }
    await client.notification.create({
      data: {
        type: NotificationType.EXPENSE_DRAWER_PENDING,
        severity: NotificationSeverity.WARNING,
        title: `Dépense tiroir à confirmer — ${input.reference}`,
        body: `${input.amountLabel} sur ${input.registerLabel} (saisie par ${input.createdByName}). Confirmez la sortie d’espèces en caisse.`,
        entityType: "Expense",
        entityId: input.expenseId,
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