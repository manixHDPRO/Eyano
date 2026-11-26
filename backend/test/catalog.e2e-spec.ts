import { INestApplication } from "@nestjs/common";
import { CategoryStatus, ProductStatus } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P8_Catalog";
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Catalogue catégories / produits (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    stores: [] as string[],
    storeUsers: [] as string[],
  };
  let suffix = "";
  let centralEmail = "";
  let cashierEmail = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    suffix = `${Date.now()}`;

    const roles = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "CASHIER" } }),
    ]);

    const cashier = await prisma.user.create({
      data: {
        email: `p8.cashier.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Caisse",
        lastName: "Catalogue",
        status: "ACTIVE",
        roleId: roles[1].id,
      },
    });
    const central = await prisma.user.create({
      data: {
        email: `p8.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Catalogue",
        status: "ACTIVE",
        roleId: roles[0].id,
      },
    });
    cleanup.users.push(cashier.id, central.id);
    cashierEmail = cashier.email;
    centralEmail = central.email;
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
      await prisma.productStore.deleteMany({ where: { storeId: { in: cleanup.stores } } });
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
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    await app.close();
  });

  it("refuse l’écriture catalogue au caissier, lecture seulement", async () => {
    const token = await login(app, cashierEmail);
    await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Interdit" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: "X-1",
        name: "Interdit",
        categoryId: "00000000-0000-0000-0000-000000000001",
        purchasePrice: 1,
        officialPrice: 1,
      })
      .expect(403);
    const list = await request(app.getHttpServer())
      .get("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
  });

  it("crée un arbre à deux niveaux et refuse le troisième", async () => {
    const token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Boissons ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id);

    const child = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Eaux ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(child.body.id);
    expect(child.body.depth).toBe(2);

    const forbidden = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Eaux plates ${suffix}`, parentId: child.body.id })
      .expect(409);
    expect(forbidden.body.code).toBe("CATEGORY_DEPTH_EXCEEDED");
  });

  it("crée un produit central sans product_stores et refuse la référence dupliquée", async () => {
    const token = await login(app, centralEmail);
    const tree = await request(app.getHttpServer())
      .get("/api/v1/categories/leaves")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const leaf = (tree.body.items as Array<{ id: string; name: string }>).find((item) =>
      item.name.includes(suffix),
    );
    expect(leaf).toBeDefined();

    const reference = `EAU-${suffix}`.slice(0, 32);
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference,
        name: "Eau minérale 50 cl",
        categoryId: leaf!.id,
        brand: "Virunga",
        originCountry: "RDC",
        purchasePrice: 0.4,
        officialPrice: 1,
        discountPercent: 0,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    expect(created.body.status).toBe(ProductStatus.DRAFT);
    expect(created.body.authorizedStoreCount).toBe(0);
    expect(created.body.reference).toBe(reference);

    const stores = await prisma.productStore.count({ where: { productId: created.body.id } });
    expect(stores).toBe(0);

    const openPrices = await prisma.productPrice.count({
      where: { productId: created.body.id, validTo: null },
    });
    const openDiscounts = await prisma.productDiscount.count({
      where: { productId: created.body.id, validTo: null },
    });
    expect(openPrices).toBe(1);
    expect(openDiscounts).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: reference.toLowerCase(),
        name: "Clone",
        categoryId: leaf!.id,
        purchasePrice: 1,
        officialPrice: 2,
      })
      .expect(409);
    expect(duplicate.body.code).toBe("PRODUCT_REFERENCE_TAKEN");

    const photo = await request(app.getHttpServer())
      .post(`/api/v1/products/${created.body.id}/photo`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PNG_1x1, { filename: "eau.png", contentType: "image/png" })
      .expect(201);
    expect(photo.body.photoUrl).toMatch(/\/uploads\/products\//);

    const activated = await request(app.getHttpServer())
      .patch(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: ProductStatus.ACTIVE })
      .expect(200);
    expect(activated.body.status).toBe(ProductStatus.ACTIVE);

    const archivedCategory = await request(app.getHttpServer())
      .post(`/api/v1/categories/${leaf!.id}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(archivedCategory.body.status).toBe(CategoryStatus.ARCHIVED);
  });

  it("supprime un produit sans historique et pagine la liste", async () => {
    const token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Delete root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Delete leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id);

    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `DEL-${suffix}`.slice(0, 32),
        name: "Article à supprimer",
        categoryId: leaf.body.id,
        purchasePrice: 1,
        officialPrice: 2,
      })
      .expect(201);

    const paged = await request(app.getHttpServer())
      .get("/api/v1/products?page=1&pageSize=1")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(paged.body.page).toBe(1);
    expect(paged.body.pageSize).toBe(1);
    expect(paged.body.totalPages).toBeGreaterThanOrEqual(1);
    expect(paged.body.items).toHaveLength(1);

    const cashierToken = await login(app, cashierEmail);
    await request(app.getHttpServer())
      .delete(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .expect(403);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(deleted.body.reference).toBe(created.body.reference);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("le caissier ne lit que les articles autorisés dans sa boutique", async () => {
    const token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Auth root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Auth leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id);

    const store = await prisma.store.create({
      data: { code: `P8${suffix}`.slice(0, 16), name: `Boutique palier 8 ${suffix}` },
    });
    cleanup.stores.push(store.id);
    const cashier = await prisma.user.findUniqueOrThrow({ where: { email: cashierEmail } });
    const membership = await prisma.storeUser.create({
      data: { userId: cashier.id, storeId: store.id, isPrimary: true },
    });
    cleanup.storeUsers.push(membership.id);

    const visible = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `VIS-${suffix}`.slice(0, 32),
        name: "Article autorisé caisse",
        categoryId: leaf.body.id,
        purchasePrice: 1,
        officialPrice: 2,
      })
      .expect(201);
    const hidden = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `HID-${suffix}`.slice(0, 32),
        name: "Article non autorisé",
        categoryId: leaf.body.id,
        purchasePrice: 1,
        officialPrice: 3,
      })
      .expect(201);
    cleanup.products.push(visible.body.id, hidden.body.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${visible.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: ProductStatus.ACTIVE })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${hidden.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: ProductStatus.ACTIVE })
      .expect(200);

    const authorized = await request(app.getHttpServer())
      .put(`/api/v1/products/${visible.body.id}/stores`)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeIds: [store.id] })
      .expect(200);
    expect(authorized.body.authorizedCount).toBe(1);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/products/${visible.body.id}/stores`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listed.body.items.some((item: { storeId: string; isAuthorized: boolean }) => item.storeId === store.id && item.isAuthorized)).toBe(
      true,
    );

    const cashierToken = await login(app, cashierEmail);
    await request(app.getHttpServer())
      .put(`/api/v1/products/${visible.body.id}/stores`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ storeIds: [store.id] })
      .expect(403);

    const cashierList = await request(app.getHttpServer())
      .get("/api/v1/products")
      .set("Authorization", `Bearer ${cashierToken}`)
      .expect(200);
    const cashierIds = (cashierList.body.items as Array<{ id: string }>).map((item) => item.id);
    expect(cashierIds).toContain(visible.body.id);
    expect(cashierIds).not.toContain(hidden.body.id);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${visible.body.id}`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/products/${hidden.body.id}`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .expect(404);
  });
});
