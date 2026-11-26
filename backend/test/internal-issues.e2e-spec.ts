import { INestApplication } from "@nestjs/common";
import { InternalIssueReason, MovementDirection } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P15_InternalIssues";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

async function readStock(
  app: INestApplication,
  token: string,
  productId: string,
  warehouseId: string,
): Promise<number> {
  const response = await request(app.getHttpServer())
    .get(`/api/v1/stock/levels?productId=${productId}&warehouseId=${warehouseId}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  const level = response.body.items[0];
  return level?.quantityOnHand ?? 0;
}

describe("Sorties internes (palier 15)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    issues: [] as string[],
  };
  let centralEmail = "";
  let warehouseId = "";
  let productId = "";
  let token = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const centralRole = await prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } });
    const central = await prisma.user.create({
      data: {
        email: `p15.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Sorties",
        status: "ACTIVE",
        roleId: centralRole.id,
      },
    });
    cleanup.users.push(central.id);
    centralEmail = central.email;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { status: "ACTIVE" } });
    warehouseId = warehouse.id;

    token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P15 root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id as string);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P15 leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id as string);
    const product = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P15-${suffix}`.slice(0, 24),
        categoryId: leaf.body.id,
        name: `Produit sortie interne ${suffix}`,
        purchasePrice: 10,
        officialPrice: 15,
      })
      .expect(201);
    productId = product.body.id as string;
    cleanup.products.push(productId);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACTIVE" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.IN,
        quantity: 40,
        note: "Stock initial palier 15",
      })
      .expect(200);
  });

  afterAll(async () => {
    if (cleanup.issues.length) {
      await prisma.notification.deleteMany({ where: { entityId: { in: cleanup.issues } } });
      await prisma.stockMovement.deleteMany({
        where: { sourceId: { in: cleanup.issues }, sourceType: "internal_stock_issue" },
      });
      await prisma.internalStockIssue.deleteMany({ where: { id: { in: cleanup.issues } } });
    }
    if (productId) {
      await prisma.stockMovement.deleteMany({ where: { productId } });
      await prisma.stockLevel.deleteMany({ where: { productId } });
    }
    await prisma.barcode.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productDiscount.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    await app.close();
  });

  it("ne modifie pas le stock en brouillon ni en attente, puis déduit à l'approbation", async () => {
    const baseline = await readStock(app, token, productId, warehouseId);
    expect(baseline).toBe(40);

    const draft = await request(app.getHttpServer())
      .post("/api/v1/internal-issues")
      .set("Authorization", `Bearer ${token}`)
      .send({
        scopeType: "WAREHOUSE",
        warehouseId,
        productId,
        quantity: 5,
        reasonCode: InternalIssueReason.INTERNAL_USE,
      })
      .expect(201);
    const issueId = draft.body.id as string;
    cleanup.issues.push(issueId);
    expect(draft.body.status).toBe("DRAFT");
    expect(await readStock(app, token, productId, warehouseId)).toBe(40);

    await request(app.getHttpServer())
      .post(`/api/v1/internal-issues/${issueId}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(await readStock(app, token, productId, warehouseId)).toBe(40);

    await request(app.getHttpServer())
      .post(`/api/v1/internal-issues/${issueId}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(await readStock(app, token, productId, warehouseId)).toBe(35);
  });

  it("rejet et annulation laissent le stock inchangé", async () => {
    const before = await readStock(app, token, productId, warehouseId);

    const toReject = await request(app.getHttpServer())
      .post("/api/v1/internal-issues")
      .set("Authorization", `Bearer ${token}`)
      .send({
        scopeType: "WAREHOUSE",
        warehouseId,
        productId,
        quantity: 2,
        reasonCode: InternalIssueReason.DAMAGED,
      })
      .expect(201);
    const rejectId = toReject.body.id as string;
    cleanup.issues.push(rejectId);
    await request(app.getHttpServer())
      .post(`/api/v1/internal-issues/${rejectId}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/internal-issues/${rejectId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reviewNote: "Motif de rejet test palier 15" })
      .expect(200);
    expect(await readStock(app, token, productId, warehouseId)).toBe(before);

    const toCancel = await request(app.getHttpServer())
      .post("/api/v1/internal-issues")
      .set("Authorization", `Bearer ${token}`)
      .send({
        scopeType: "WAREHOUSE",
        warehouseId,
        productId,
        quantity: 3,
        reasonCode: InternalIssueReason.MAINTENANCE,
      })
      .expect(201);
    const cancelId = toCancel.body.id as string;
    cleanup.issues.push(cancelId);
    await request(app.getHttpServer())
      .post(`/api/v1/internal-issues/${cancelId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Annulation test" })
      .expect(200);
    expect(await readStock(app, token, productId, warehouseId)).toBe(before);
  });
});