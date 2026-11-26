import { INestApplication } from "@nestjs/common";
import { MovementDirection, MovementType } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { INVENTORY_ERROR } from "../src/modules/inventory/inventory.constants";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P14_Inventories";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Inventaires (palier 14)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    sessions: [] as string[],
  };
  let centralEmail = "";
  let warehouseId = "";
  let productId = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const centralRole = await prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } });
    const central = await prisma.user.create({
      data: {
        email: `p14.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Inventaires",
        status: "ACTIVE",
        roleId: centralRole.id,
      },
    });
    cleanup.users.push(central.id);
    centralEmail = central.email;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { status: "ACTIVE" } });
    warehouseId = warehouse.id;

    const token = await login(app, centralEmail);
    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P14 root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id as string);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P14 leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id as string);
    const product = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P14-${suffix}`.slice(0, 24),
        categoryId: leaf.body.id,
        name: `Produit inventaire ${suffix}`,
        purchasePrice: 10,
        officialPrice: 15,
      })
      .expect(201);
    productId = product.body.id as string;
    cleanup.products.push(productId);

    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.IN,
        quantity: 100,
        note: "Stock initial palier 14",
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: MovementDirection.OUT,
        quantity: 15,
        note: "Sorties simulées",
      })
      .expect(200);
  });

  afterAll(async () => {
    if (cleanup.sessions.length) {
      await prisma.notification.deleteMany({ where: { entityId: { in: cleanup.sessions } } });
    }
    if (!productId) {
      await app.close();
      return;
    }
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.inventoryItem.deleteMany({ where: { inventorySessionId: { in: cleanup.sessions } } });
    await prisma.inventorySession.deleteMany({ where: { id: { in: cleanup.sessions } } });
    await prisma.barcode.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productDiscount.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    await app.close();
  });

  it("théorique 85, physique 83 : validation sans motif refusée puis acceptée avec ajustement", async () => {
    const token = await login(app, centralEmail);

    const created = await request(app.getHttpServer())
      .post("/api/v1/inventories")
      .set("Authorization", `Bearer ${token}`)
      .send({ scopeType: "WAREHOUSE", warehouseId, note: "Inventaire test cahier" })
      .expect(201);
    cleanup.sessions.push(created.body.id as string);

    const started = await request(app.getHttpServer())
      .post(`/api/v1/inventories/${created.body.id}/start`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const line = started.body.items?.find((item: { productId: string }) => item.productId === productId);
    expect(line?.theoreticalQty).toBe(85);

    const defaultCounted = started.body.items.map((item: { productId: string; theoreticalQty: number }) => ({
      productId: item.productId,
      physicalQty: item.theoreticalQty,
    }));
    await request(app.getHttpServer())
      .patch(`/api/v1/inventories/${created.body.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: defaultCounted.map((item: { productId: string; physicalQty: number }) =>
          item.productId === productId ? { ...item, physicalQty: 83 } : item,
        ),
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/inventories/${created.body.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/inventories/${created.body.id}/validate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(422);
    expect(rejected.body.code).toBe(INVENTORY_ERROR.JUSTIFICATION_REQUIRED);

    await request(app.getHttpServer())
      .patch(`/api/v1/inventories/${created.body.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId, physicalQty: 83, justification: "Manquant physique compté" }],
      })
      .expect(200);

    const validated = await request(app.getHttpServer())
      .post(`/api/v1/inventories/${created.body.id}/validate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(validated.body.status).toBe("VALIDATED");

    const level = await prisma.stockLevel.findFirstOrThrow({
      where: { productId, warehouseId, storeId: null },
    });
    expect(level.quantityOnHand).toBe(83);

    const movements = await prisma.stockMovement.findMany({
      where: { productId, movementType: MovementType.INVENTORY_ADJUSTMENT },
      orderBy: { occurredAt: "desc" },
    });
    expect(movements[0]?.quantity).toBe(2);
    expect(movements[0]?.direction).toBe(MovementDirection.OUT);
  });
});