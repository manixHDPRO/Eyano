import { INestApplication } from "@nestjs/common";
import { GoodsReceiptStatus, MovementType } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { STOCK_SOURCE_TYPE } from "../src/modules/stock-movements/stock-movements.constants";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P11_Suppliers";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Fournisseurs et réceptions (palier 11)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    suppliers: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    receipts: [] as string[],
  };
  let centralEmail = "";
  let staffEmail = "";
  let warehouseId = "";
  let productId = "";
  let purchaseBefore = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);

    const [centralRole, staffRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "ADMIN_STAFF" } }),
    ]);

    const central = await prisma.user.create({
      data: {
        email: `p11.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Réceptions",
        status: "ACTIVE",
        roleId: centralRole.id,
      },
    });
    const staff = await prisma.user.create({
      data: {
        email: `p11.staff.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Staff",
        lastName: "Lecture",
        status: "ACTIVE",
        roleId: staffRole.id,
      },
    });
    cleanup.users.push(central.id, staff.id);
    centralEmail = central.email;
    staffEmail = staff.email;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { status: "ACTIVE" } });
    warehouseId = warehouse.id;

    const token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P11 root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id as string);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P11 leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id as string);

    const product = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P11-${suffix}`.slice(0, 24),
        name: `Article réception ${suffix}`,
        categoryId: leaf.body.id,
        purchasePrice: 3.5,
        officialPrice: 10,
      })
      .expect(201);
    productId = product.body.id as string;
    purchaseBefore = String(product.body.purchasePrice);
    cleanup.products.push(productId);
  });

  afterAll(async () => {
    for (const receiptId of cleanup.receipts) {
      await prisma.stockMovement.deleteMany({ where: { sourceId: receiptId } });
      await prisma.stockLevel.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: receiptId } });
      await prisma.goodsReceipt.deleteMany({ where: { id: receiptId } });
    }
    if (cleanup.suppliers.length > 0) {
      await prisma.supplier.deleteMany({ where: { id: { in: cleanup.suppliers } } });
    }
    if (cleanup.products.length > 0) {
      await prisma.barcode.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.productPrice.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.productDiscount.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } });
    }
    if (cleanup.categories.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } });
    }
    if (cleanup.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    await app.close();
  });

  it("crée un fournisseur et une réception brouillon", async () => {
    const token = await login(app, centralEmail);
    const supplier = await request(app.getHttpServer())
      .post("/api/v1/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Fournisseur ${suffix}`, phone: "+243700000000" })
      .expect(201);
    cleanup.suppliers.push(supplier.body.id as string);

    const receipt = await request(app.getHttpServer())
      .post("/api/v1/goods-receipts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId: supplier.body.id,
        warehouseId,
        items: [{ productId, quantity: 12, unitCost: 4.25 }],
      })
      .expect(201);
    cleanup.receipts.push(receipt.body.id as string);
    expect(receipt.body.status).toBe(GoodsReceiptStatus.DRAFT);
    expect(receipt.body.reference).toMatch(/^RC\d{6}$/);
    expect(receipt.body.items).toHaveLength(1);
  });

  it("refuse la validation sans permission receipts.validate pour le staff", async () => {
    const tokenCentral = await login(app, centralEmail);
    const supplier = await request(app.getHttpServer())
      .post("/api/v1/suppliers")
      .set("Authorization", `Bearer ${tokenCentral}`)
      .send({ name: `Fournisseur staff ${suffix}` })
      .expect(201);
    cleanup.suppliers.push(supplier.body.id as string);

    const receipt = await request(app.getHttpServer())
      .post("/api/v1/goods-receipts")
      .set("Authorization", `Bearer ${tokenCentral}`)
      .send({
        supplierId: supplier.body.id,
        warehouseId,
        items: [{ productId, quantity: 5, unitCost: 3.75 }],
      })
      .expect(201);
    cleanup.receipts.push(receipt.body.id as string);

    const staffToken = await login(app, staffEmail);
    await request(app.getHttpServer())
      .post(`/api/v1/goods-receipts/${receipt.body.id}/validate`)
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(403);
  });

  it("valide une réception : stock +X une fois, pas de changement prix catalogue", async () => {
    const token = await login(app, centralEmail);
    const supplier = await request(app.getHttpServer())
      .post("/api/v1/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Fournisseur stock ${suffix}` })
      .expect(201);
    cleanup.suppliers.push(supplier.body.id as string);

    const quantity = 17;
    const receipt = await request(app.getHttpServer())
      .post("/api/v1/goods-receipts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId: supplier.body.id,
        warehouseId,
        items: [{ productId, quantity, unitCost: 6.1 }],
      })
      .expect(201);
    const receiptId = receipt.body.id as string;
    cleanup.receipts.push(receiptId);

    const validated = await request(app.getHttpServer())
      .post(`/api/v1/goods-receipts/${receiptId}/validate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(validated.body.status).toBe(GoodsReceiptStatus.VALIDATED);
    expect(validated.body.stock).toEqual([{ productId, quantityOnHand: quantity }]);

    const level = await prisma.stockLevel.findFirst({
      where: { productId, warehouseId },
    });
    expect(level?.quantityOnHand).toBe(quantity);

    const movements = await prisma.stockMovement.findMany({
      where: { sourceType: STOCK_SOURCE_TYPE.GOODS_RECEIPT, sourceId: receiptId },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.movementType).toBe(MovementType.GOODS_RECEIPT);
    expect(movements[0]?.quantity).toBe(quantity);

    const productAfter = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(productAfter.purchasePrice.toString()).toBe(purchaseBefore);

    await request(app.getHttpServer())
      .post(`/api/v1/goods-receipts/${receiptId}/validate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);

    const levelAfterRetry = await prisma.stockLevel.findFirst({
      where: { productId, warehouseId },
    });
    expect(levelAfterRetry?.quantityOnHand).toBe(quantity);

    const movementCount = await prisma.stockMovement.count({
      where: { sourceType: STOCK_SOURCE_TYPE.GOODS_RECEIPT, sourceId: receiptId },
    });
    expect(movementCount).toBe(1);
  });
});