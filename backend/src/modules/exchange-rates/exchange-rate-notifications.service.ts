import { Injectable } from "@nestjs/common";
import { NotificationSeverity, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SETTING_NOTIFY_RATE } from "./exchange-rates.constants";

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ExchangeRateNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyPairChanged(
    client: DbClient,
    input: { encaissementRate: string; decaissementRate: string; entityId: string },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_RATE))) {
      return;
    }
    const encLabel = Number(input.encaissementRate).toLocaleString("fr-FR");
    const decLabel = Number(input.decaissementRate).toLocaleString("fr-FR");
    await client.notification.create({
      data: {
        type: NotificationType.RATE_CHANGED,
        severity: NotificationSeverity.WARNING,
        title: "Modification des taux de change",
        body: `Nouveau taux : Encaissement ${encLabel} CDF / Décaissement ${decLabel} CDF.`,
        entityType: "ExchangeRate",
        entityId: input.entityId,
      },
    });
  }

  async notifyRateChanged(
    client: DbClient,
    input: { rateType: string; previousRate: string | null; nextRate: string; entityId: string },
  ): Promise<void> {
    if (!(await isEnabled(client, SETTING_NOTIFY_RATE))) {
      return;
    }
    const label = input.rateType === "ENCAISSEMENT" ? "Encaissement" : "Décaissement";
    await client.notification.create({
      data: {
        type: NotificationType.RATE_CHANGED,
        severity: NotificationSeverity.WARNING,
        title: `Taux ${label}`,
        body:
          input.previousRate === null
            ? `Nouveau taux ${label} : ${input.nextRate} CDF / USD.`
            : `Taux ${label} : ${input.previousRate} → ${input.nextRate} CDF / USD.`,
        entityType: "ExchangeRate",
        entityId: input.entityId,
      },
    });
  }
}

async function isEnabled(client: DbClient, key: string): Promise<boolean> {
  const row = await client.appSetting.findUnique({ where: { key } });
  return row?.value === true;
}