import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CaseResult = { name: string; passed: boolean; detail: string };

async function expectReject(name: string, sql: string): Promise<CaseResult> {
  try {
    await prisma.$executeRawUnsafe(sql);
    return { name, passed: false, detail: "accepté alors qu'un rejet était attendu" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const rejected =
      /23514|23505|check constraint|unique constraint|duplicate key|viole la contrainte|existe déjà/i.test(
        message,
      );
    return {
      name,
      passed: rejected,
      detail: rejected ? "rejeté comme prévu" : `erreur inattendue: ${message}`,
    };
  }
}

async function expectOk(name: string, sql: string): Promise<CaseResult> {
  try {
    await prisma.$executeRawUnsafe(sql);
    return { name, passed: true, detail: "accepté" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, passed: false, detail: message };
  }
}

async function scalar<T>(sql: string): Promise<T> {
  const rows = await prisma.$queryRawUnsafe<T[]>(sql);
  return rows[0];
}

async function main(): Promise<void> {
  const admin = await prisma.user.findFirstOrThrow({
    where: { email: process.env.SEED_SUPERADMIN_EMAIL ?? "admin@eyano.local" },
  });
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { code: "CENTRAL" } });

  const store = await prisma.store.upsert({
    where: { code: "P2-TEST" },
    update: {},
    create: { code: "P2-TEST", name: "Boutique test palier 2", city: "Kinshasa", status: "ACTIVE" },
  });

  const category = await prisma.category.upsert({
    where: { slug: "p2-test" },
    update: {},
    create: { name: "Catégorie test palier 2", slug: "p2-test", status: "ACTIVE" },
  });

  const product = await prisma.product.upsert({
    where: { reference: "P2-SKU-001" },
    update: {},
    create: {
      reference: "P2-SKU-001",
      name: "Article test palier 2",
      categoryId: category.id,
      purchasePrice: "10.00",
      officialPrice: "50.00",
      discountPercent: "0",
      finalPrice: "50.00",
      status: "ACTIVE",
      createdById: admin.id,
    },
  });

  const register = await prisma.cashRegister.upsert({
    where: { storeId_code: { storeId: store.id, code: "C1" } },
    update: {},
    create: { storeId: store.id, code: "C1", name: "Caisse 1", isDefault: true },
  });

  await prisma.stockLevel.deleteMany({ where: { productId: product.id } });
  await prisma.productPrice.deleteMany({ where: { productId: product.id } });
  await prisma.productDiscount.deleteMany({ where: { productId: product.id } });
  await prisma.barcode.deleteMany({ where: { productId: product.id } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: register.id } });
  await prisma.cashRegister.deleteMany({ where: { storeId: store.id, code: { not: "C1" } } });
  await prisma.exchangeRate.deleteMany({
    where: { createdById: admin.id, validTo: { not: null } },
  });

  const results: CaseResult[] = [];

  results.push(
    await expectOk(
      "solde entrepôt valide",
      `INSERT INTO stock_levels (id, product_id, warehouse_id, store_id, quantity_on_hand, quantity_reserved)
       VALUES (eyano_uuid_v7(), '${product.id}', '${warehouse.id}', NULL, 10, 2)`,
    ),
  );

  const warehouseLevel = await scalar<{ id: string }>(
    `SELECT id FROM stock_levels WHERE product_id = '${product.id}' AND warehouse_id = '${warehouse.id}'`,
  );

  results.push(
    await expectReject(
      "stock négatif refusé",
      `UPDATE stock_levels SET quantity_on_hand = -1 WHERE id = '${warehouseLevel.id}'`,
    ),
  );

  results.push(
    await expectReject(
      "réservé > physique refusé",
      `UPDATE stock_levels SET quantity_reserved = 99 WHERE id = '${warehouseLevel.id}'`,
    ),
  );

  results.push(
    await expectReject(
      "lieu double (entrepôt + boutique) refusé",
      `INSERT INTO stock_levels (id, product_id, warehouse_id, store_id, quantity_on_hand, quantity_reserved)
       VALUES (eyano_uuid_v7(), '${product.id}', '${warehouse.id}', '${store.id}', 1, 0)`,
    ),
  );

  results.push(
    await expectReject(
      "solde sans lieu refusé",
      `INSERT INTO stock_levels (id, product_id, warehouse_id, store_id, quantity_on_hand, quantity_reserved)
       VALUES (eyano_uuid_v7(), '${product.id}', NULL, NULL, 1, 0)`,
    ),
  );

  results.push(
    await expectOk(
      "solde boutique valide",
      `INSERT INTO stock_levels (id, product_id, warehouse_id, store_id, quantity_on_hand, quantity_reserved)
       VALUES (eyano_uuid_v7(), '${product.id}', NULL, '${store.id}', 3, 0)`,
    ),
  );

  results.push(
    await expectReject(
      "second solde boutique du même produit refusé",
      `INSERT INTO stock_levels (id, product_id, warehouse_id, store_id, quantity_on_hand, quantity_reserved)
       VALUES (eyano_uuid_v7(), '${product.id}', NULL, '${store.id}', 1, 0)`,
    ),
  );

  results.push(
    await expectOk(
      "ligne de prix ouverte",
      `INSERT INTO product_prices (id, product_id, purchase_price, official_price, currency, valid_from, valid_to, created_by)
       VALUES (eyano_uuid_v7(), '${product.id}', 10, 50, 'USD', now(), NULL, '${admin.id}')`,
    ),
  );

  results.push(
    await expectReject(
      "seconde ligne de prix ouverte refusée",
      `INSERT INTO product_prices (id, product_id, purchase_price, official_price, currency, valid_from, valid_to, created_by)
       VALUES (eyano_uuid_v7(), '${product.id}', 11, 55, 'USD', now(), NULL, '${admin.id}')`,
    ),
  );

  results.push(
    await expectReject(
      "remise > 100 % refusée",
      `INSERT INTO product_discounts (id, product_id, percent, valid_from, valid_to, created_by)
       VALUES (eyano_uuid_v7(), '${product.id}', 101, now(), NULL, '${admin.id}')`,
    ),
  );

  results.push(
    await expectOk(
      "remise 20 % ouverte",
      `INSERT INTO product_discounts (id, product_id, percent, valid_from, valid_to, created_by)
       VALUES (eyano_uuid_v7(), '${product.id}', 20, now(), NULL, '${admin.id}')`,
    ),
  );

  results.push(
    await expectReject(
      "seconde remise ouverte refusée",
      `INSERT INTO product_discounts (id, product_id, percent, valid_from, valid_to, created_by)
       VALUES (eyano_uuid_v7(), '${product.id}', 10, now(), NULL, '${admin.id}')`,
    ),
  );

  results.push(
    await expectOk(
      "session de caisse ouverte",
      `INSERT INTO cash_sessions (id, cash_register_id, opened_by, status, opening_float_usd, opening_float_cdf)
       VALUES (eyano_uuid_v7(), '${register.id}', '${admin.id}', 'OPEN', 0, 0)`,
    ),
  );

  results.push(
    await expectReject(
      "seconde session ouverte sur la même caisse refusée",
      `INSERT INTO cash_sessions (id, cash_register_id, opened_by, status, opening_float_usd, opening_float_cdf)
       VALUES (eyano_uuid_v7(), '${register.id}', '${admin.id}', 'OPEN', 10, 0)`,
    ),
  );

  results.push(
    await expectOk(
      "code-barres unique",
      `INSERT INTO barcodes (id, product_id, code, symbology)
       VALUES (eyano_uuid_v7(), '${product.id}', 'P2TEST001', 'CODE128')`,
    ),
  );

  results.push(
    await expectReject(
      "code-barres dupliqué refusé",
      `INSERT INTO barcodes (id, product_id, code, symbology)
       VALUES (eyano_uuid_v7(), '${product.id}', 'P2TEST001', 'CODE128')`,
    ),
  );

  results.push(
    await expectReject(
      "référence produit dupliquée refusée",
      `INSERT INTO products (id, reference, name, category_id, purchase_price, official_price, discount_percent, final_price, status, created_by)
       VALUES (eyano_uuid_v7(), 'P2-SKU-001', 'Doublon', '${category.id}', 1, 1, 0, 1, 'DRAFT', '${admin.id}')`,
    ),
  );

  results.push(
    await expectReject(
      "seconde caisse par défaut de la même boutique refusée",
      `INSERT INTO cash_registers (id, store_id, code, name, is_default, status)
       VALUES (eyano_uuid_v7(), '${store.id}', 'C2', 'Caisse 2', true, 'ACTIVE')`,
    ),
  );

  results.push(
    await expectOk(
      "seconde caisse non défaut autorisée",
      `INSERT INTO cash_registers (id, store_id, code, name, is_default, status)
       VALUES (eyano_uuid_v7(), '${store.id}', 'C2', 'Caisse 2', false, 'ACTIVE')`,
    ),
  );

  results.push(
    await expectReject(
      "code caisse dupliqué dans la boutique refusé",
      `INSERT INTO cash_registers (id, store_id, code, name, is_default, status)
       VALUES (eyano_uuid_v7(), '${store.id}', 'C1', 'Doublon', false, 'ACTIVE')`,
    ),
  );

  results.push(
    await expectReject(
      "Mobile Money sans référence refusé",
      `INSERT INTO payments (id, sale_id, method, currency, amount, amount_usd, provider_reference)
       VALUES (eyano_uuid_v7(), eyano_uuid_v7(), 'MPESA', 'CDF', 1000, 0.04, NULL)`,
    ),
  );

  const failed = results.filter((result) => !result.passed);
  for (const result of results) {
    const mark = result.passed ? "OK" : "KO";
    console.log(`[${mark}] ${result.name} — ${result.detail}`);
  }

  if (failed.length > 0) {
    throw new Error(`${failed.length} contrainte(s) non tenue(s)`);
  }

  console.log(`\n${results.length} cas : toutes les contraintes attendues sont tenues.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
