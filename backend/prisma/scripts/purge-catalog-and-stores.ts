/**
 * Supprime boutiques, caisses, catalogue (produits + catégories) et toutes les
 * opérations qui y sont rattachées, en conservant utilisateurs, rôles, permissions,
 * paramètres applicatifs, taux de change, séquences et l'entrepôt central.
 *
 * Usage :
 *   EYANO_PURGE_CONFIRM=1 npx tsx prisma/scripts/purge-catalog-and-stores.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.EYANO_PURGE_CONFIRM !== "1") {
    console.error(
      "Opération destructive : définissez EYANO_PURGE_CONFIRM=1 pour confirmer la purge du catalogue et des boutiques.",
    );
    process.exit(1);
  }

  const counts = await prisma.$transaction(async (tx) => {
    const saleIdempotencyKeys = await tx.saleIdempotencyKey.deleteMany();
    const payments = await tx.payment.deleteMany();
    const saleItems = await tx.saleItem.deleteMany();
    const sales = await tx.sale.deleteMany();
    const expenses = await tx.expense.deleteMany();
    const cashSessions = await tx.cashSession.deleteMany();
    const inventoryItems = await tx.inventoryItem.deleteMany();
    const inventorySessions = await tx.inventorySession.deleteMany();
    const internalIssues = await tx.internalStockIssue.deleteMany();
    const transferItems = await tx.transferItem.deleteMany();
    const transfers = await tx.transfer.deleteMany();
    const goodsReceiptItems = await tx.goodsReceiptItem.deleteMany();
    const goodsReceipts = await tx.goodsReceipt.deleteMany();
    const stockMovements = await tx.stockMovement.deleteMany();
    const stockLevels = await tx.stockLevel.deleteMany();
    const barcodePrintLogs = await tx.barcodePrintLog.deleteMany();
    const barcodes = await tx.barcode.deleteMany();
    const productStores = await tx.productStore.deleteMany();
    const productPrices = await tx.productPrice.deleteMany();
    const productDiscounts = await tx.productDiscount.deleteMany();
    const notifications = await tx.notification.deleteMany();
    const auditLogs = await tx.auditLog.deleteMany();
    const products = await tx.product.deleteMany();
    const storeUsers = await tx.storeUser.deleteMany();
    const cashRegisters = await tx.cashRegister.deleteMany();
    const stores = await tx.store.deleteMany();

    const categories = await deleteAllCategoriesInTx(tx);

    return {
      saleIdempotencyKeys: saleIdempotencyKeys.count,
      payments: payments.count,
      saleItems: saleItems.count,
      sales: sales.count,
      expenses: expenses.count,
      cashSessions: cashSessions.count,
      inventoryItems: inventoryItems.count,
      inventorySessions: inventorySessions.count,
      internalIssues: internalIssues.count,
      transferItems: transferItems.count,
      transfers: transfers.count,
      goodsReceiptItems: goodsReceiptItems.count,
      goodsReceipts: goodsReceipts.count,
      stockMovements: stockMovements.count,
      stockLevels: stockLevels.count,
      barcodePrintLogs: barcodePrintLogs.count,
      barcodes: barcodes.count,
      productStores: productStores.count,
      productPrices: productPrices.count,
      productDiscounts: productDiscounts.count,
      notifications: notifications.count,
      auditLogs: auditLogs.count,
      products: products.count,
      categories,
      storeUsers: storeUsers.count,
      cashRegisters: cashRegisters.count,
      stores: stores.count,
    };
  });

  console.log("Purge terminée :");
  console.table(counts);

  const [users, roles, permissions, settings, warehouses, suppliers] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.appSetting.count(),
    prisma.warehouse.count(),
    prisma.supplier.count(),
  ]);

  console.log("Conservé :");
  console.table({ users, roles, permissions, settings, warehouses, suppliers });
}

type PrismaTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function deleteAllCategoriesInTx(tx: PrismaTx): Promise<number> {
  let total = 0;
  for (;;) {
    const leaves = await tx.category.findMany({
      where: { children: { none: {} } },
      select: { id: true },
    });
    if (leaves.length === 0) {
      const remaining = await tx.category.count();
      if (remaining > 0) {
        throw new Error("Impossible de vider les catégories : cycle ou état incohérent.");
      }
      break;
    }
    const ids = leaves.map((row) => row.id);
    const batch = await tx.category.deleteMany({ where: { id: { in: ids } } });
    total += batch.count;
  }
  return total;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });