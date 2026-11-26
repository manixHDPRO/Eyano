import { INestApplication } from "@nestjs/common";
import { ProductStatus } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { convertUsdToCdf } from "../src/common/money";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P17_Payments";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Paiements (palier 17)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  let token = "";
  let sessionId = "";
  let productId = "";
  let registerId = "";
  let storeId = "";
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    stores: [] as string[],
    sales: [] as string[],
  };

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } });
    const email = `p17-pay-${suffix}@eyano.test`;
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName: "Pay", lastName: "Test", roleId: role.id, status: "ACTIVE" },
    });
    cleanup.users.push(user.id);
    token = await login(app, email);

    const store = await prisma.store.create({
      data: { code: `P17${suffix.slice(-5)}`, name: "Boutique P17", status: "ACTIVE" },
    });
    storeId = store.id;
    cleanup.stores.push(store.id);

    const register = await prisma.cashRegister.create({
      data: { storeId, code: "C17", name: "Caisse P17", isDefault: true, status: "ACTIVE" },
    });
    registerId = register.id;

    const parent = await prisma.category.create({
      data: { name: `CatP17-${suffix}`, slug: `cat-p17-${suffix}` },
    });
    cleanup.categories.push(parent.id);
    const leaf = await prisma.category.create({
      data: { name: `LeafP17`, slug: `leaf-p17-${suffix}`, parentId: parent.id },
    });
    cleanup.categories.push(leaf.id);

    const product = await prisma.product.create({
      data: {
        reference: `P17-${suffix}`,
        name: "Article 100 USD",
        categoryId: leaf.id,
        status: ProductStatus.ACTIVE,
        purchasePrice: "40.00",
        officialPrice: "100.00",
        discountPercent: "0",
        finalPrice: "100.00",
        createdById: user.id,
      },
    });
    productId = product.id;
    cleanup.products.push(product.id);

    await prisma.productStore.create({
      data: { productId, storeId, isAuthorized: true, authorizedBy: user.id },
    });
    await prisma.stockLevel.create({
      data: { productId, storeId, warehouseId: null, quantityOnHand: 10, quantityReserved: 0 },
    });

    const session = await request(app.getHttpServer())
      .post("/api/v1/cash-sessions/open")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashRegisterId: registerId, openingFloatUsd: 0, openingFloatCdf: 0 })
      .expect(201);
    sessionId = session.body.id as string;
  });

  afterAll(async () => {
    if (cleanup.sales.length) {
      await prisma.payment.deleteMany({ where: { saleId: { in: cleanup.sales } } });
      await prisma.saleIdempotencyKey.deleteMany({ where: { saleId: { in: cleanup.sales } } });
      await prisma.saleItem.deleteMany({ where: { saleId: { in: cleanup.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: cleanup.sales } } });
    }
    await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } }).catch(() => undefined);
    await prisma.cashRegister.delete({ where: { id: registerId } }).catch(() => undefined);
    await prisma.stockLevel.deleteMany({ where: { productId, storeId } }).catch(() => undefined);
    await prisma.productStore.deleteMany({ where: { productId, storeId } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } }).catch(() => undefined);
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } }).catch(() => undefined);
    await prisma.store.deleteMany({ where: { id: { in: cleanup.stores } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } }).catch(() => undefined);
    await app.close();
  });

  it("refuse un déséquilibre de paiements", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `p17-imbalance-${suffix}`)
      .send({
        cashSessionId: sessionId,
        items: [{ productId, quantity: 1 }],
        payments: [{ method: "CASH", currency: "USD", amount: 50 }],
      })
      .expect(409);
  });

  it("vente 100 USD = 50 cash USD + reliquat CDF au taux du jour", async () => {
    const rates = await request(app.getHttpServer())
      .get("/api/v1/exchange-rates/current")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const encaissement = rates.body.encaissement.rate as number;
    const cdfRemainder = Number(convertUsdToCdf(50, encaissement));

    const created = await request(app.getHttpServer())
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `p17-mixed-${suffix}`)
      .send({
        cashSessionId: sessionId,
        items: [{ productId, quantity: 1 }],
        payments: [
          { method: "CASH", currency: "USD", amount: 50 },
          { method: "CASH", currency: "CDF", amount: cdfRemainder },
        ],
      })
      .expect(201);

    cleanup.sales.push(created.body.id as string);
    expect(Number(created.body.total)).toBe(100);

    const payments = await prisma.payment.findMany({ where: { saleId: created.body.id as string } });
    expect(payments).toHaveLength(2);
    const paidUsd = payments.reduce((sum, row) => sum + Number(row.amountUsd), 0);
    expect(paidUsd).toBe(100);
    const cdfLine = payments.find((row) => row.currency === "CDF");
    expect(cdfLine?.rateSnapshot).not.toBeNull();
    expect(cdfLine?.exchangeRateId).not.toBeNull();
  });
});