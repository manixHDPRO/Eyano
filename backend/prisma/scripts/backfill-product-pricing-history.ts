/**
 * Rétro-remplit product_prices / product_discounts pour les produits créés
 * avant le palier 9 (cache sur la fiche sans lignes historiques ouvertes).
 *
 * Usage : npm run prisma:backfill-pricing
 * (exige DATABASE_URL ; idempotent — ne touche pas aux produits déjà conformes).
 */
import "dotenv/config";
import { CurrencyCode, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      reference: true,
      purchasePrice: true,
      officialPrice: true,
      discountPercent: true,
      createdById: true,
    },
    orderBy: { reference: "asc" },
  });

  let createdPrices = 0;
  let createdDiscounts = 0;
  const now = new Date();

  for (const product of products) {
    await prisma.$transaction(async (tx) => {
      const openPrice = await tx.productPrice.findFirst({
        where: { productId: product.id, validTo: null },
      });
      if (!openPrice) {
        const hasAnyPrice = await tx.productPrice.count({ where: { productId: product.id } });
        if (hasAnyPrice === 0) {
          await tx.productPrice.create({
            data: {
              productId: product.id,
              purchasePrice: product.purchasePrice,
              officialPrice: product.officialPrice,
              currency: CurrencyCode.USD,
              validFrom: now,
              createdById: product.createdById,
              reason: "Rétro-remplissage palier 9",
            },
          });
          createdPrices += 1;
        } else {
          console.warn(
            `[backfill] ${product.reference} : prix historisés mais aucune ligne ouverte — intervention manuelle requise.`,
          );
        }
      }

      const openDiscount = await tx.productDiscount.findFirst({
        where: { productId: product.id, validTo: null },
      });
      if (!openDiscount) {
        const hasAnyDiscount = await tx.productDiscount.count({ where: { productId: product.id } });
        if (hasAnyDiscount === 0) {
          await tx.productDiscount.create({
            data: {
              productId: product.id,
              percent: product.discountPercent,
              validFrom: now,
              createdById: product.createdById,
              reason: "Rétro-remplissage palier 9",
            },
          });
          createdDiscounts += 1;
        } else {
          console.warn(
            `[backfill] ${product.reference} : remises historisées mais aucune ligne ouverte — intervention manuelle requise.`,
          );
        }
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        productsScanned: products.length,
        openPriceLinesCreated: createdPrices,
        openDiscountLinesCreated: createdDiscounts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });