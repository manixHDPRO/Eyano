/**
 * Rétro-remplit un code-barres Code 128 pour les produits créés avant le palier 10.
 *
 * Usage : npm run prisma:backfill-barcodes
 * (exige DATABASE_URL ; idempotent — ignore les articles déjà codés).
 */
import "dotenv/config";
import { BarcodeSymbology, PrismaClient } from "@prisma/client";
import { generateBarcodePayload, isCode128BCompatible } from "../../src/modules/barcodes/barcode-code";

const prisma = new PrismaClient();
const MAX_ATTEMPTS = 8;

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { barcode: null },
    select: { id: true, reference: true },
    orderBy: { reference: "asc" },
  });

  let created = 0;
  for (const product of products) {
    let allocated = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const code = generateBarcodePayload();
      if (!isCode128BCompatible(code)) {
        continue;
      }
      try {
        await prisma.barcode.create({
          data: {
            productId: product.id,
            code,
            symbology: BarcodeSymbology.CODE128,
          },
        });
        created += 1;
        allocated = true;
        break;
      } catch (error) {
        const codeName = typeof error === "object" && error && "code" in error ? (error as { code: string }).code : "";
        if (codeName !== "P2002") {
          throw error;
        }
      }
    }
    if (!allocated) {
      console.warn(`[backfill] ${product.reference} : allocation impossible après ${MAX_ATTEMPTS} essais.`);
    }
  }

  console.log(`Barcodes backfill: ${created} code(s) créé(s) pour ${products.length} article(s) sans code.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
