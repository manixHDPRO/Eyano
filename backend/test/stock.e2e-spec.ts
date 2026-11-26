import { INestApplication } from "@nestjs/common";
import { MovementDirection, MovementType, NotificationType } from "@prisma/client";
import { STOCK_AUDIT } from "../src/modules/stock-movements/stock-movements.constants";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P12_Stock";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Stock — soldes, mouvements, alertes (palier 12)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    auditIds: [] as string[],
  };
  let centralEmail = "";
  let superEmail = "";
  let superUserId = "";
  let warehouseId = "";
  let productId = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);

    const [centralRole, superRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } }),
    ]);
    const central = await prisma.user.create({
      data: {
        email: `p12.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Stock",
        status: "ACTIVE",
        roleId: centralRole.id,
      },
    });
    const superUser = await prisma.user.create({
      data: {
        email: `p12.super.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Super",
        lastName: "Stock",
        status: "ACTIVE",
        roleId: superRole.id,
      },
    });
    cleanup.users.push(central.id, superUser.id);
    centralEmail = central.email;
    superEmail = superUser.email;
    superUserId = superUser.id;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { status: "ACTIVE" } });
    warehouseId = warehouse.id;

    const token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P12 root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id as string);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P12 leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id as string);

    const product = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P12-${suffix}`.slice(0, 24),
        name: `Article stock ${suffix}`,
        categoryId: leaf.body.id,
        purchasePrice: 2,
        officialPrice: 8,
        alertThreshold: 10,
      })
      .expect(201);
    productId = product.body.id as string;
    cleanup.products.push(productId);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { entityId: productId },
    });
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.barcode.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productDiscount.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } });
    if (cleanup.auditIds.length) {
      await prisma.auditLog.deleteMany({ where: { id: { in: cleanup.auditIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    await app.close();
  });

  it("mouvement IN puis OUT déclenche LOW_STOCK et STOCKOUT", async () => {
    const token = await login(app, centralEmail);

    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.IN,
        quantity: 15,
        note: "Entrée test palier 12",
      })
      .expect(200);

    const lowCross = await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.OUT,
        quantity: 6,
        note: "Sortie vers seuil",
      })
      .expect(200);

    expect(lowCross.body.quantityOnHand).toBe(9);

    const lowNotifications = await prisma.notification.findMany({
      where: { entityId: productId, type: NotificationType.LOW_STOCK },
    });
    expect(lowNotifications.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.OUT,
        quantity: 9,
        note: "Rupture",
      })
      .expect(200);

    const stockout = await prisma.notification.findMany({
      where: { entityId: productId, type: NotificationType.STOCKOUT },
    });
    expect(stockout.length).toBeGreaterThanOrEqual(1);

    const levels = await request(app.getHttpServer())
      .get(`/api/v1/stock/levels?productId=${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(levels.body.items[0]?.alertStatus).toBe("STOCKOUT");
    expect(levels.body.items[0]?.quantityOnHand).toBe(0);
  });

  it("refuse une sortie au-delà du disponible", async () => {
    const token = await login(app, centralEmail);
    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.OUT,
        quantity: 1,
        note: "Doit échouer",
      })
      .expect(409);
  });

  it("summary, grand livre et filtre alerte LOW", async () => {
    const token = await login(app, centralEmail);

    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.IN,
        quantity: 5,
        note: "Remise à niveau pour filtres",
      })
      .expect(200);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/stock/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(summary.body.totalLevels).toBeGreaterThanOrEqual(1);

    const movements = await request(app.getHttpServer())
      .get(`/api/v1/stock/movements?productId=${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(movements.body.items.some((row: { movementType: string }) => row.movementType === MovementType.MANUAL_ADJUSTMENT)).toBe(
      true,
    );

    const lowLevels = await request(app.getHttpServer())
      .get(`/api/v1/stock/levels?productId=${productId}&alertStatus=LOW`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(lowLevels.body.items.length).toBeGreaterThanOrEqual(1);
    expect(lowLevels.body.items[0]?.alertStatus).toBe("LOW");
  });

  it("réconciliation super admin sans écart et refus admin central", async () => {
    const centralToken = await login(app, centralEmail);
    await request(app.getHttpServer())
      .post(`/api/v1/stock/reconcile?productId=${productId}`)
      .set("Authorization", `Bearer ${centralToken}`)
      .expect(403);

    const superToken = await login(app, superEmail);
    const reconcile = await request(app.getHttpServer())
      .post(`/api/v1/stock/reconcile?productId=${productId}`)
      .set("Authorization", `Bearer ${superToken}`)
      .expect(200);

    expect(reconcile.body.discrepancyCount).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: STOCK_AUDIT.RECONCILE, actorId: superUserId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    if (audit) {
      cleanup.auditIds.push(audit.id);
    }
  });
});