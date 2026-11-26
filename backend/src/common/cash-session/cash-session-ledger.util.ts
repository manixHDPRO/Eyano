import { CashSessionStatus, CurrencyCode, ExpenseStatus, PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";

type PrismaTx = Omit<PrismaService, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export type CashSessionLedger = {
  collectionsUsd: number;
  collectionsCdf: number;
  expensesUsd: number;
  expensesCdf: number;
  theoreticalBalanceUsd: number;
  theoreticalBalanceCdf: number;
};

export async function computeCashSessionLedger(
  client: PrismaTx | PrismaService,
  sessionId: string,
  openingFloatUsd: number,
  openingFloatCdf: number,
): Promise<CashSessionLedger> {
  const salesWhere: Prisma.SaleWhereInput = {
    cashSessionId: sessionId,
    status: SaleStatus.COMPLETED,
  };

  const [cashUsdAgg, cashCdfAgg, expenseUsdAgg, expenseCdfAgg] = await Promise.all([
    client.payment.aggregate({
      where: {
        method: PaymentMethod.CASH,
        currency: CurrencyCode.USD,
        sale: salesWhere,
      },
      _sum: { amount: true },
    }),
    client.payment.aggregate({
      where: {
        method: PaymentMethod.CASH,
        currency: CurrencyCode.CDF,
        sale: salesWhere,
      },
      _sum: { amount: true },
    }),
    client.expense.aggregate({
      where: {
        cashSessionId: sessionId,
        currency: CurrencyCode.USD,
        status: ExpenseStatus.CONFIRMED,
      },
      _sum: { amount: true },
    }),
    client.expense.aggregate({
      where: {
        cashSessionId: sessionId,
        currency: CurrencyCode.CDF,
        status: ExpenseStatus.CONFIRMED,
      },
      _sum: { amount: true },
    }),
  ]);

  const collectionsUsd = Number(cashUsdAgg._sum.amount ?? 0);
  const collectionsCdf = Number(cashCdfAgg._sum.amount ?? 0);
  const expensesUsd = Number(expenseUsdAgg._sum.amount ?? 0);
  const expensesCdf = Number(expenseCdfAgg._sum.amount ?? 0);

  return {
    collectionsUsd,
    collectionsCdf,
    expensesUsd,
    expensesCdf,
    theoreticalBalanceUsd: openingFloatUsd + collectionsUsd - expensesUsd,
    theoreticalBalanceCdf: openingFloatCdf + collectionsCdf - expensesCdf,
  };
}

export async function findOpenSessionForStore(
  client: PrismaTx | PrismaService,
  storeId: string,
  cashRegisterId?: string,
): Promise<{ id: string; cashRegisterId: string } | null> {
  if (cashRegisterId) {
    const direct = await client.cashSession.findFirst({
      where: {
        cashRegisterId,
        status: CashSessionStatus.OPEN,
        cashRegister: { storeId },
      },
      select: { id: true, cashRegisterId: true },
    });
    if (direct) {
      return direct;
    }
  }

  return client.cashSession.findFirst({
    where: {
      status: CashSessionStatus.OPEN,
      cashRegister: { storeId },
    },
    orderBy: { openedAt: "desc" },
    select: { id: true, cashRegisterId: true },
  });
}