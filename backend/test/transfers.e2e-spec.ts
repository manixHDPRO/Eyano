import { INestApplication } from "@nestjs/common";
import { MovementType, NotificationType, TransferStatus } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { TRANSFER_ERROR } from "../src/modules/transfers/transfers.constants";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P13_Transfers";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Transferts et écarts (palier 13)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cleanup = {
    users: [] as string[],
    products: [] as string[],
    categories: [] as string[],
    stores: [] as string[],
    transfers: [] as string[],
  };
  let centralEmail = "";
  let warehouseId = "";
  let storeAId = "";
  let storeBId = "";
  let productId = "";
  let unauthorizedProductId = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const centralRole = await prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } });
    const central = await prisma.user.create({
      data: {
        email: `p13.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Transferts",
        status: "ACTIVE",
        roleId: centralRole.id,
      },
    });
    cleanup.users.push(central.id);
    centralEmail = central.email;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { status: "ACTIVE" } });
    warehouseId = warehouse.id;

    const token = await login(app, centralEmail);
    const storeA = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `p13a-${suffix}`.slice(0, 16), name: "Boutique transfert A" })
      .expect(201);
    const storeB = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `p13b-${suffix}`.slice(0, 16), name: "Boutique transfert B" })
      .expect(201);
    storeAId = storeA.body.id as string;
    storeBId = storeB.body.id as string;
    cleanup.stores.push(storeAId, storeBId);

    const root = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P13 root ${suffix}` })
      .expect(201);
    cleanup.categories.push(root.body.id as string);
    const leaf = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `P13 leaf ${suffix}`, parentId: root.body.id })
      .expect(201);
    cleanup.categories.push(leaf.body.id as string);

    const product = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P13A-${suffix}`.slice(0, 24),
        name: `Article transfert ${suffix}`,
        categoryId: leaf.body.id,
        purchasePrice: 4,
        officialPrice: 12,
      })
      .expect(201);
    productId = product.body.id as string;
    cleanup.products.push(productId);

    const other = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reference: `P13B-${suffix}`.slice(0, 24),
        name: `Article non autorisé ${suffix}`,
        categoryId: leaf.body.id,
        purchasePrice: 2,
        officialPrice: 7,
      })
      .expect(201);
    unauthorizedProductId = other.body.id as string;
    cleanup.products.push(unauthorizedProductId);

    await request(app.getHttpServer())
      .put(`/api/v1/products/${productId}/stores`)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeIds: [storeAId] })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/stock/manual-adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId,
        warehouseId,
        direction: "IN",
        quantity: 20,
        note: "Stock initial palier 13",
      })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { OR: [{ entityId: { in: cleanup.transfers } }, { entityId: { in: cleanup.products } }] },
    });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.transferItem.deleteMany({ where: { transferId: { in: cleanup.transfers } } });
    await prisma.transfer.deleteMany({ where: { id: { in: cleanup.transfers } } });
    await prisma.productStore.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.barcode.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.productDiscount.deleteMany({ where: { productId: { in: cleanup.products } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } });
    await prisma.cashRegister.deleteMany({ where: { storeId: { in: cleanup.stores } } });
    await prisma.store.deleteMany({ where: { id: { in: cleanup.stores } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    await app.close();
  });

  it("refuse un transfert vers une boutique non autorisée", async () => {
    const token = await login(app, centralEmail);
    const created = await request(app.getHttpServer())
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        warehouseId,
        storeId: storeBId,
        items: [{ productId, quantityRequested: 2 }],
      })
      .expect(409);
    expect(created.body.code).toBe(TRANSFER_ERROR.PRODUCT_NOT_AUTHORIZED);

    const draft = await request(app.getHttpServer())
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({ warehouseId, storeId: storeAId })
      .expect(201);
    cleanup.transfers.push(draft.body.id as string);

    await request(app.getHttpServer())
      .put(`/api/v1/transfers/${draft.body.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ productId: unauthorizedProductId, quantityRequested: 1 }] })
      .expect(409)
      .expect((res) => {
        expect(res.body.code).toBe(TRANSFER_ERROR.PRODUCT_NOT_AUTHORIZED);
      });
  });

  it("annule avant expédition et libère la réservation", async () => {
    const token = await login(app, centralEmail);
    const created = await request(app.getHttpServer())
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        warehouseId,
        storeId: storeAId,
        items: [{ productId, quantityRequested: 5 }],
      })
      .expect(201);
    cleanup.transfers.push(created.body.id as string);

    await request(app.getHttpServer())
      .post(`/api/v1/transfers/${created.body.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/transfers/${created.body.id}/validate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const reserved = await prisma.stockLevel.findFirstOrThrow({
      where: { productId, warehouseId, storeId: null },
    });
    expect(reserved.quantityReserved).toBe(5);
    expect(reserved.quantityOnHand).toBe(20);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/transfers/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Commande boutique annulée" })
      .expect(200);
    expect(cancelled.body.status).toBe(TransferStatus.CANCELLED);

    const released = await prisma.stockLevel.findFirstOrThrow({
      where: { productId, warehouseId, storeId: null },
    });
    expect(released.quantityReserved).toBe(0);
    expect(released.quantityOnHand).toBe(20);
  });

  it("cycle demande → validé → expédié → reçu avec écart négatif signalé", async () => {
    const token = await login(app, centralEmail);
    const created = await request(app.getHttpServer())
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        warehouseId,
        storeId: storeAId,
        note: "Approvisionnement vitrine",
        items: [{ productId, quantityRequested: 10 }],
      })
      .expect(201);
    const transferId = created.body.id as string;
    cleanup.transfers.push(transferId);
    expect(created.body.reference).toMatch(/^TR\d{6}$/);
    expect(created.body.status).toBe(TransferStatus.DRAFT);

    const submitted = await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(submitted.body.status).toBe(TransferStatus.PENDING);

    const pendingNote = await prisma.notification.findFirst({
      where: { entityId: transferId, type: NotificationType.TRANSFER_PENDING },
    });
    expect(pendingNote).toBeTruthy();

    const validated = await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/validate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(validated.body.status).toBe(TransferStatus.VALIDATED);

    const reserved = await prisma.stockLevel.findFirstOrThrow({
      where: { productId, warehouseId, storeId: null },
    });
    expect(reserved.quantityReserved).toBe(10);
    expect(reserved.quantityOnHand).toBe(20);

    await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/prepare`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const shipped = await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/ship`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(shipped.body.status).toBe(TransferStatus.SHIPPED);
    expect(shipped.body.items[0].quantityShipped).toBe(10);

    const afterShip = await prisma.stockLevel.findFirstOrThrow({
      where: { productId, warehouseId, storeId: null },
    });
    expect(afterShip.quantityOnHand).toBe(10);
    expect(afterShip.quantityReserved).toBe(0);

    const outMovement = await prisma.stockMovement.findFirst({
      where: { productId, movementType: MovementType.TRANSFER_OUT, sourceId: transferId },
    });
    expect(outMovement?.quantity).toBe(10);

    await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "trop tard" })
      .expect(409);

    const received = await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ productId, quantityReceived: 7 }], complete: true })
      .expect(200);
    expect(received.body.status).toBe(TransferStatus.RECEIVED);
    expect(received.body.hasVariance).toBe(true);
    expect(received.body.items[0].quantityReceived).toBe(7);
    expect(received.body.items[0].variance).toBe(-3);

    const storeLevel = await prisma.stockLevel.findFirstOrThrow({
      where: { productId, storeId: storeAId, warehouseId: null },
    });
    expect(storeLevel.quantityOnHand).toBe(7);

    const warehouseLevel = await prisma.stockLevel.findFirstOrThrow({
      where: { productId, warehouseId, storeId: null },
    });
    expect(warehouseLevel.quantityOnHand).toBe(10);

    const inMovement = await prisma.stockMovement.findFirst({
      where: { productId, movementType: MovementType.TRANSFER_IN, sourceId: transferId },
    });
    expect(inMovement?.quantity).toBe(7);

    const varianceNote = await prisma.notification.findFirst({
      where: { entityId: transferId, type: NotificationType.TRANSFER_RECEIVED },
    });
    expect(varianceNote).toBeTruthy();
    expect(varianceNote?.severity).toBe("WARNING");
    expect(varianceNote?.body).toMatch(/manquant reste sorti/i);
  });
});
