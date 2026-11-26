import { INestApplication } from "@nestjs/common";
import { PrintContext } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P10_Barcodes";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Codes-barres (palier 10)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    stores: [] as string[],
    storeUsers: [] as string[],
    roles: [] as string[],
  };
  let centralEmail = "";
  let cashierEmail = "";
  let staffEmail = "";
  let leafCategoryId = "";
  let cashierStoreId = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const [centralRole, cashierRole, staffRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "CASHIER" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "ADMIN_STAFF" } }),
    ]);

    const central = await prisma.user.create({
      data: {
        email: `p10.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Barcodes",
        status: "ACTIVE",
        roleId: centralRole.id,
      },
    });
    const cashier = await prisma.user.create({
      data: {
        email: `p10.cashier.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Caisse",
        lastName: "Barcodes",
        status: "ACTIVE",
        roleId: cashierRole.id,
      },
    });
    const staff = await prisma.user.create({
      data: {
        email: `p10.staff.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Staff",
        lastName: "Impression",
        status: "ACTIVE",
        roleId: staffRole.id,
      },
    });
    cleanup.users.push(central.id, cashier.id, staff.id);
    centralEmail = central.email;
    cashierEmail = cashier.email;
    staffEmail = staff.email;

    const store = await prisma.store.create({
      data: {
        code: `P10${suffix}`.slice(0, 8),
        name: "Boutique palier 10",
        status: "ACTIVE",
      },
    });
    cleanup.stores.push(store.id);
    cashierStoreId = store.id;
    const membership = await prisma.storeUser.create({
      data: { userId: cashier.id, storeId: store.id, isPrimary: true, assignedBy: central.id },
    });
    cleanup.storeUsers.push(membership.id);

    const token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P10 root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P10 leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id);
    leafCategoryId = leaf.body.id as string;
  });

  afterAll(async () => {
    if (cleanup.products.length > 0) {
      await prisma.barcodePrintLog.deleteMany({ where: { barcode: { productId: { in: cleanup.products } } } });
      await prisma.barcode.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.notification.deleteMany({ where: { entityId: { in: cleanup.products } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: cleanup.products } } });
      await prisma.productPrice.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.productDiscount.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.productStore.deleteMany({ where: { productId: { in: cleanup.products } } });
      await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } });
    }
    if (cleanup.storeUsers.length > 0) {
      await prisma.storeUser.deleteMany({ where: { id: { in: cleanup.storeUsers } } });
    }
    if (cleanup.stores.length > 0) {
      await prisma.store.deleteMany({ where: { id: { in: cleanup.stores } } });
    }
    if (cleanup.categories.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: cleanup.categories } } });
      await prisma.category.deleteMany({
        where: { id: { in: cleanup.categories }, parentId: { not: null } },
      });
      await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } });
    }
    if (cleanup.users.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: cleanup.users } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    if (cleanup.roles.length > 0) {
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: cleanup.roles } } });
      await prisma.role.deleteMany({ where: { id: { in: cleanup.roles } } });
    }
    await app.close();
  });

  async function createProduct(token: string, name: string): Promise<{ id: string; barcode: { code: string } }> {
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P10${cleanup.products.length}${suffix}`.slice(0, 32),
        name,
        categoryId: leafCategoryId,
        purchasePrice: 1,
        officialPrice: 2,
        discountPercent: 0,
      })
      .expect(201);
    cleanup.products.push(created.body.id);
    return created.body;
  }

  it("attribue un Code 128 unique à la création, distinct d’un second article", async () => {
    const token = await login(app, centralEmail);
    const first = await createProduct(token, "Article A");
    const second = await createProduct(token, "Article B");

    expect(first.barcode.code).toMatch(/^EY[0-9]{6}$/);
    expect(second.barcode.code).toMatch(/^EY[0-9]{6}$/);
    expect(first.barcode.code).not.toBe(second.barcode.code);

    await expect(
      prisma.barcode.update({
        where: { productId: second.id },
        data: { code: first.barcode.code },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("ne régénère pas le code à la réimpression et journalise auteur, copies, contexte", async () => {
    const token = await login(app, centralEmail);
    const product = await createProduct(token, "Réimpression");
    const codeBefore = product.barcode.code;

    const printed = await request(app.getHttpServer())
      .post("/api/v1/barcodes/print")
      .set("Authorization", `Bearer ${token}`)
      .send({ productIds: [product.id], copies: 4 })
      .expect(201);

    expect(printed.body.context).toBe(PrintContext.SINGLE);
    expect(printed.body.copies).toBe(4);
    expect(printed.body.items[0].barcode.code).toBe(codeBefore);
    expect(printed.body.logs).toHaveLength(1);
    expect(printed.body.logs[0].copies).toBe(4);
    expect(printed.body.logs[0].context).toBe(PrintContext.SINGLE);
    expect(printed.body.logs[0].printedByName).toContain("Central");

    const again = await request(app.getHttpServer())
      .post("/api/v1/barcodes/products/" + product.id)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(again.body.barcode.code).toBe(codeBefore);

    const logs = await request(app.getHttpServer())
      .get(`/api/v1/barcodes/print-logs?productId=${product.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(logs.body.total).toBe(1);
    expect(logs.body.items[0].copies).toBe(4);
  });

  it("journalise un lot en contexte BATCH", async () => {
    const token = await login(app, centralEmail);
    const first = await createProduct(token, "Lot A");
    const second = await createProduct(token, "Lot B");

    const printed = await request(app.getHttpServer())
      .post("/api/v1/barcodes/print")
      .set("Authorization", `Bearer ${token}`)
      .send({ productIds: [first.id, second.id], copies: 2 })
      .expect(201);

    expect(printed.body.context).toBe(PrintContext.BATCH);
    expect(printed.body.logs).toHaveLength(2);
    expect(printed.body.logs.every((row: { context: string; copies: number }) => row.context === "BATCH" && row.copies === 2)).toBe(
      true,
    );
  });

  it("refuse l’impression au caissier et lui permet de retrouver un article autorisé par code", async () => {
    const token = await login(app, centralEmail);
    const product = await createProduct(token, "Scan caisse");
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${product.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACTIVE" })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/products/${product.id}/stores`)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeIds: [cashierStoreId] })
      .expect(200);

    const cashierToken = await login(app, cashierEmail);
    await request(app.getHttpServer())
      .post("/api/v1/barcodes/print")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ productIds: [product.id], copies: 1 })
      .expect(403);

    const found = await request(app.getHttpServer())
      .get(`/api/v1/barcodes/lookup?code=${product.barcode.code}`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .expect(200);
    expect(found.body.product.id).toBe(product.id);
    expect(found.body.barcode.code).toBe(product.barcode.code);
  });

  it("autorise le personnel administratif à imprimer sans régénérer", async () => {
    const token = await login(app, centralEmail);
    const product = await createProduct(token, "Staff print");
    const staffToken = await login(app, staffEmail);

    await request(app.getHttpServer())
      .post("/api/v1/barcodes/products/" + product.id)
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(403);

    const printed = await request(app.getHttpServer())
      .post("/api/v1/barcodes/print")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ productIds: [product.id], copies: 1 })
      .expect(201);
    expect(printed.body.items[0].barcode.code).toBe(product.barcode.code);
  });
});
