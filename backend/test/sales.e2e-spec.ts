import { INestApplication } from "@nestjs/common";
import { ProductStatus } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P16_Sales";

function payCashUsd(amount: number) {
  return [{ method: "CASH" as const, currency: "USD" as const, amount }];
}

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Ventes et caisse (palier 16)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    stores: [] as string[],
    sales: [] as string[],
  };
  let token = "";
  let storeId = "";
  let registerId = "";
  let sessionId = "";
  let productId = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);

    const role = await prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } });
    const email = `p16-sales-${suffix}@eyano.test`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: "Test",
        lastName: "Ventes",
        roleId: role.id,
        status: "ACTIVE",
      },
    });
    cleanup.users.push(user.id);
    token = await login(app, email);

    const store = await prisma.store.create({
      data: {
        code: `T${suffix.slice(-6)}`,
        name: `Boutique test ${suffix}`,
        status: "ACTIVE",
      },
    });
    cleanup.stores.push(store.id);
    storeId = store.id;

    const register = await prisma.cashRegister.create({
      data: {
        storeId,
        code: "C99",
        name: "Caisse test",
        isDefault: true,
        status: "ACTIVE",
      },
    });
    registerId = register.id;

    const parent = await prisma.category.create({
      data: { name: `Cat P16 ${suffix}`, slug: `cat-p16-${suffix}` },
    });
    cleanup.categories.push(parent.id);
    const leaf = await prisma.category.create({
      data: { name: `Leaf P16 ${suffix}`, slug: `leaf-p16-${suffix}`, parentId: parent.id },
    });
    cleanup.categories.push(leaf.id);

    const product = await prisma.product.create({
      data: {
        reference: `P16-${suffix}`,
        name: `Produit vente ${suffix}`,
        categoryId: leaf.id,
        status: ProductStatus.ACTIVE,
        purchasePrice: "10.00",
        officialPrice: "25.00",
        discountPercent: "0",
        finalPrice: "25.00",
        createdById: user.id,
      },
    });
    cleanup.products.push(product.id);
    productId = product.id;

    await prisma.productStore.create({
      data: { productId, storeId, isAuthorized: true, authorizedBy: user.id },
    });

    await prisma.stockLevel.create({
      data: { productId, storeId, warehouseId: null, quantityOnHand: 1, quantityReserved: 0 },
    });

    const openSession = await request(app.getHttpServer())
      .post("/api/v1/cash-sessions/open")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashRegisterId: registerId, openingFloatUsd: 0, openingFloatCdf: 0 })
      .expect(201);
    sessionId = openSession.body.id as string;
  });

  afterAll(async () => {
    if (cleanup.sales.length) {
      await prisma.saleIdempotencyKey.deleteMany({ where: { saleId: { in: cleanup.sales } } });
      await prisma.saleItem.deleteMany({ where: { saleId: { in: cleanup.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: cleanup.sales } } });
    }
    await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } }).catch(() => undefined);
    await prisma.cashRegister.deleteMany({ where: { id: registerId } }).catch(() => undefined);
    await prisma.stockLevel.deleteMany({ where: { productId, storeId } }).catch(() => undefined);
    await prisma.productStore.deleteMany({ where: { productId, storeId } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } }).catch(() => undefined);
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } }).catch(() => undefined);
    await prisma.store.deleteMany({ where: { id: { in: cleanup.stores } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } }).catch(() => undefined);
    await app.close();
  });

  it("refuse une vente sans Idempotency-Key", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashSessionId: sessionId, items: [{ productId, quantity: 1 }], payments: payCashUsd(25) })
      .expect(400);
  });

  it("refuse un produit non autorisé dans la boutique", async () => {
    const unauthorized = await prisma.product.create({
      data: {
        reference: `P16U-${suffix}`,
        name: `Non autorisé ${suffix}`,
        categoryId: cleanup.categories[cleanup.categories.length - 1]!,
        status: ProductStatus.ACTIVE,
        purchasePrice: "5.00",
        officialPrice: "12.00",
        discountPercent: "0",
        finalPrice: "12.00",
        createdById: cleanup.users[0]!,
      },
    });
    cleanup.products.push(unauthorized.id);

    await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `p16-unauth-${suffix}`)
      .send({
        cashSessionId: sessionId,
        items: [{ productId: unauthorized.id, quantity: 1 }],
        payments: payCashUsd(12),
      })
      .expect(409);
  });

  it("enregistre une vente puis rejette la seconde concurrente", async () => {
    const first = await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `p16-first-${suffix}`)
      .send({
        cashSessionId: sessionId,
        items: [{ productId, quantity: 1 }],
        payments: payCashUsd(25),
      })
      .expect(201);
    cleanup.sales.push(first.body.id as string);

    await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `p16-second-${suffix}`)
      .send({
        cashSessionId: sessionId,
        items: [{ productId, quantity: 1 }],
        payments: payCashUsd(25),
      })
      .expect(409);
  });

  it("rejoue la même clé idempotence sans doubler", async () => {
    const key = `p16-replay-${suffix}`;
    const stock = await prisma.stockLevel.findFirstOrThrow({ where: { productId, storeId } });
    await prisma.stockLevel.update({ where: { id: stock.id }, data: { quantityOnHand: 5 } });

    const created = await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({
        cashSessionId: sessionId,
        items: [{ productId, quantity: 1 }],
        payments: payCashUsd(25),
      })
      .expect(201);
    cleanup.sales.push(created.body.id as string);

    const replay = await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({
        cashSessionId: sessionId,
        items: [{ productId, quantity: 1 }],
        payments: payCashUsd(25),
      })
      .expect(201);

    expect(replay.body.id).toBe(created.body.id);
    expect(replay.body.idempotentReplay).toBe(true);

    const saleCount = await prisma.sale.count({
      where: { id: { in: cleanup.sales }, status: "COMPLETED" },
    });
    expect(saleCount).toBeGreaterThanOrEqual(2);
  });
});