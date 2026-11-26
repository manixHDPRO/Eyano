import { INestApplication } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { computeFinalPrice } from "../src/common/money";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P9_Pricing";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Prix et remises (palier 9)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    roles: [] as string[],
  };
  let centralEmail = "";
  let cashierEmail = "";
  let catalogOnlyEmail = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const [centralRole, cashierRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "CASHIER" } }),
    ]);
    const central = await prisma.user.create({
      data: {
        email: `p9.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Pricing",
        status: "ACTIVE",
        roleId: centralRole.id,
      },
    });
    const cashier = await prisma.user.create({
      data: {
        email: `p9.cashier.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Caisse",
        lastName: "Pricing",
        status: "ACTIVE",
        roleId: cashierRole.id,
      },
    });
    const productsManage = await prisma.permission.findUniqueOrThrow({ where: { code: "products.manage" } });
    const catalogRole = await prisma.role.create({
      data: {
        code: `P9_CATALOG_${suffix}`.slice(0, 32),
        name: "Catalogue sans tarif",
        description: "Test palier 9 — products.manage sans prices.update",
        isSystem: false,
        rolePermissions: { create: { permissionId: productsManage.id } },
      },
    });
    cleanup.roles.push(catalogRole.id);
    const catalogOnly = await prisma.user.create({
      data: {
        email: `p9.catalog.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Catalogue",
        lastName: "Seul",
        status: "ACTIVE",
        roleId: catalogRole.id,
      },
    });
    cleanup.users.push(central.id, cashier.id, catalogOnly.id);
    centralEmail = central.email;
    cashierEmail = cashier.email;
    catalogOnlyEmail = catalogOnly.email;
  });

  afterAll(async () => {
    for (const productId of cleanup.products) {
      await prisma.barcodePrintLog.deleteMany({ where: { barcode: { productId } } });
      await prisma.barcode.deleteMany({ where: { productId } });
      await prisma.notification.deleteMany({ where: { entityId: productId } });
      await prisma.auditLog.deleteMany({ where: { entityId: productId } });
      await prisma.productPrice.deleteMany({ where: { productId } });
      await prisma.productDiscount.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (cleanup.categories.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } });
    }
    if (cleanup.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    if (cleanup.roles.length > 0) {
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: cleanup.roles } } });
      await prisma.role.deleteMany({ where: { id: { in: cleanup.roles } } });
    }
    await app.close();
  });

  async function createLeafCategory(token: string): Promise<string> {
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P9 root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P9 leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id);
    return leaf.body.id as string;
  }

  it("ouvre une ligne prix et une ligne remise à la création, sans notification", async () => {
    const token = await login(app, centralEmail);
    const categoryId = await createLeafCategory(token);
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P9-${suffix}`.slice(0, 32),
        name: "Article tarif initial",
        categoryId,
        purchasePrice: 10,
        officialPrice: 50,
        discountPercent: 0,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    const openPrices = await prisma.productPrice.count({
      where: { productId: created.body.id, validTo: null },
    });
    const openDiscounts = await prisma.productDiscount.count({
      where: { productId: created.body.id, validTo: null },
    });
    expect(openPrices).toBe(1);
    expect(openDiscounts).toBe(1);
    expect(created.body.finalPrice).toBe(50);

    const notifs = await prisma.notification.count({
      where: { entityId: created.body.id, type: NotificationType.PRICE_CHANGED },
    });
    expect(notifs).toBe(0);
  });

  it("formule officielle 50 USD − 20 % = 40.00 et conserve l’historique", async () => {
    expect(computeFinalPrice(50, 20)).toBe("40.00");

    const token = await login(app, centralEmail);
    const categoryId = await createLeafCategory(token);
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P9B-${suffix}`.slice(0, 32),
        name: "Article remise",
        categoryId,
        purchasePrice: 5,
        officialPrice: 50,
        discountPercent: 0,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/discounts/products/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ percent: 20, reason: "Promotion test" })
      .expect(200);

    expect(updated.body.product.finalPrice).toBe(40);
    expect(updated.body.discounts).toHaveLength(2);
    expect(updated.body.openDiscountId).toBeTruthy();

    const openDiscount = updated.body.discounts.find((row: { validTo: string | null }) => row.validTo === null);
    expect(openDiscount?.percent).toBe(20);
    expect(openDiscount?.previousPercent).toBe(0);

    const closed = updated.body.discounts.find((row: { validTo: string | null }) => row.validTo !== null);
    expect(closed?.percent).toBe(0);
    expect(closed?.previousPercent).toBeNull();

    const notifs = await prisma.notification.count({
      where: { entityId: created.body.id, type: NotificationType.DISCOUNT_CHANGED },
    });
    expect(notifs).toBeGreaterThanOrEqual(1);
  });

  it("historise un changement de prix via PATCH /pricing/products/:id/prices", async () => {
    const token = await login(app, centralEmail);
    const categoryId = await createLeafCategory(token);
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P9P-${suffix}`.slice(0, 32),
        name: "Article prix",
        categoryId,
        purchasePrice: 4,
        officialPrice: 50,
        discountPercent: 0,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/pricing/products/${created.body.id}/prices`)
      .set("Authorization", `Bearer ${token}`)
      .send({ purchasePrice: 5, officialPrice: 55, reason: "Révision fournisseur" })
      .expect(200);

    expect(updated.body.product.officialPrice).toBe(55);
    expect(updated.body.prices).toHaveLength(2);
    expect(updated.body.prices.filter((row: { validTo: string | null }) => row.validTo === null)).toHaveLength(1);
    expect(updated.body.openPriceId).toBeTruthy();

    const openPrices = await prisma.productPrice.count({
      where: { productId: created.body.id, validTo: null },
    });
    expect(openPrices).toBe(1);
  });

  it("applique une remise 100 % avec prix final nul", async () => {
    const token = await login(app, centralEmail);
    const categoryId = await createLeafCategory(token);
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P9D100-${suffix}`.slice(0, 32),
        name: "Article gratuit",
        categoryId,
        purchasePrice: 1,
        officialPrice: 25,
        discountPercent: 0,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/discounts/products/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ percent: 100 })
      .expect(200);

    expect(updated.body.product.finalPrice).toBe(0);
    expect(computeFinalPrice(25, 100)).toBe("0.00");
  });

  it("refuse le tarif sur PATCH /products sans prices.update", async () => {
    const centralToken = await login(app, centralEmail);
    const categoryId = await createLeafCategory(centralToken);
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${centralToken}`)
      .send({
        reference: `P9PERM-${suffix}`.slice(0, 32),
        name: "Article permission",
        categoryId,
        purchasePrice: 1,
        officialPrice: 10,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    const catalogToken = await login(app, catalogOnlyEmail);
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${catalogToken}`)
      .send({ officialPrice: 99 })
      .expect(403);
  });

  it("filtre l’overview tarifaire par recherche", async () => {
    const token = await login(app, centralEmail);
    const categoryId = await createLeafCategory(token);
    const unique = `ZYXTAR${suffix}`;
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: unique.slice(0, 32),
        name: `Recherche tarif ${suffix}`,
        categoryId,
        purchasePrice: 1,
        officialPrice: 3,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    const found = await request(app.getHttpServer())
      .get(`/api/v1/pricing/overview?search=${encodeURIComponent(unique)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(found.body.items.some((row: { id: string }) => row.id === created.body.id)).toBe(true);
  });

  it("refuse la modification tarifaire pour un caissier", async () => {
    const token = await login(app, centralEmail);
    const categoryId = await createLeafCategory(token);
    const created = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P9C-${suffix}`.slice(0, 32),
        name: "Article protégé",
        categoryId,
        purchasePrice: 1,
        officialPrice: 2,
      })
      .expect(201);
    cleanup.products.push(created.body.id);

    const cashierToken = await login(app, cashierEmail);
    await request(app.getHttpServer())
      .patch(`/api/v1/pricing/products/${created.body.id}/prices`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ purchasePrice: 1, officialPrice: 99 })
      .expect(403);
  });
});