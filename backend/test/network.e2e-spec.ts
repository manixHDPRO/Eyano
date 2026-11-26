import { INestApplication } from "@nestjs/common";
import { ReferentialStatus } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P7_Network";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Réseau boutiques / entrepôt / caisses (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cleanup = {
    users: [] as string[],
    stores: [] as string[],
    registers: [] as string[],
  };
  let suffix = "";
  let centralEmail = "";
  let cashierEmail = "";
  let superEmail = "";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    suffix = `${Date.now()}`;

    const roles = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "CASHIER" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } }),
    ]);

    const cashier = await prisma.user.create({
      data: {
        email: `p7.cashier.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Caisse",
        lastName: "Test",
        status: "ACTIVE",
        roleId: roles[1].id,
      },
    });
    const central = await prisma.user.create({
      data: {
        email: `p7.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Admin",
        status: "ACTIVE",
        roleId: roles[0].id,
      },
    });
    const superAdmin = await prisma.user.create({
      data: {
        email: `p7.super.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Super",
        lastName: "Admin",
        status: "ACTIVE",
        roleId: roles[2].id,
      },
    });
    cleanup.users.push(cashier.id, central.id, superAdmin.id);
    cashierEmail = cashier.email;
    centralEmail = central.email;
    superEmail = superAdmin.email;
  });

  afterAll(async () => {
    if (cleanup.registers.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: cleanup.registers } } });
      await prisma.cashRegister.deleteMany({ where: { id: { in: cleanup.registers } } });
    }
    if (cleanup.stores.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: cleanup.stores } } });
      await prisma.cashRegister.deleteMany({ where: { storeId: { in: cleanup.stores } } });
      await prisma.storeUser.deleteMany({ where: { storeId: { in: cleanup.stores } } });
      await prisma.store.deleteMany({ where: { id: { in: cleanup.stores } } });
    }
    if (cleanup.users.length > 0) {
      await prisma.storeUser.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    await app.close();
  });

  it("refuse le CRUD réseau au caissier", async () => {
    const token = await login(app, cashierEmail);
    await request(app.getHttpServer()).get("/api/v1/stores").set("Authorization", `Bearer ${token}`).expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "X", name: "Interdit" })
      .expect(403);
  });

  it("crée une boutique avec sa caisse par défaut", async () => {
    const token = await login(app, centralEmail);
    const response = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: `p7a-${suffix}`.slice(0, 16),
        name: "Boutique Gombe",
        city: "Kinshasa",
        receiptHeader: "Eyano Gombe",
        receiptFooter: "Merci et à bientôt",
      })
      .expect(201);

    cleanup.stores.push(response.body.id);
    for (const register of response.body.cashRegisters ?? []) {
      cleanup.registers.push(register.id);
    }

    expect(response.body.code).toMatch(/^P7A-/);
    expect(response.body.status).toBe(ReferentialStatus.ACTIVE);
    expect(response.body.cashRegisters).toHaveLength(1);
    expect(response.body.cashRegisters[0].code).toBe("C01");
    expect(response.body.cashRegisters[0].isDefault).toBe(true);

    const audits = await prisma.auditLog.findMany({ where: { entityId: response.body.id } });
    expect(audits.some((row) => row.action === "STORE_CREATED")).toBe(true);
  });

  it("refuse un code boutique dupliqué", async () => {
    const token = await login(app, centralEmail);
    const first = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `p7b-${suffix}`.slice(0, 16), name: "Boutique B" })
      .expect(201);
    cleanup.stores.push(first.body.id);

    await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `p7b-${suffix}`.slice(0, 16), name: "Doublon" })
      .expect(409);
  });

  it("refuse un code caisse dupliqué dans la même boutique", async () => {
    const token = await login(app, centralEmail);
    const store = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `p7c-${suffix}`.slice(0, 16), name: "Boutique C" })
      .expect(201);
    cleanup.stores.push(store.body.id);

    await request(app.getHttpServer())
      .post("/api/v1/cash-registers")
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: store.body.id, code: "C01", name: "Doublon" })
      .expect(409);

    const second = await request(app.getHttpServer())
      .post("/api/v1/cash-registers")
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: store.body.id, code: "C02", name: "Caisse 2" })
      .expect(201);
    cleanup.registers.push(second.body.id);
    expect(second.body.isDefault).toBe(false);
  });

  it("transfere le défaut lorsqu’une nouvelle caisse est marquée par défaut", async () => {
    const token = await login(app, centralEmail);
    const store = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `p7d-${suffix}`.slice(0, 16), name: "Boutique D" })
      .expect(201);
    cleanup.stores.push(store.body.id);
    const firstId = store.body.cashRegisters[0].id as string;

    const second = await request(app.getHttpServer())
      .post("/api/v1/cash-registers")
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: store.body.id, code: "C02", name: "Caisse 2", isDefault: true })
      .expect(201);
    cleanup.registers.push(second.body.id);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/cash-registers?storeId=${store.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const defaults = listed.body.items.filter((row: { isDefault: boolean }) => row.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.body.id);

    const previous = listed.body.items.find((row: { id: string }) => row.id === firstId);
    expect(previous.isDefault).toBe(false);
  });

  it("refuse la suppression de boutique à l’administrateur central", async () => {
    const token = await login(app, centralEmail);
    const store = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `p7x-${suffix}`.slice(0, 16), name: "À garder" })
      .expect(201);
    cleanup.stores.push(store.body.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${store.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/stores/${store.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listed.body.id).toBe(store.body.id);
  });

  it("autorise le super admin à supprimer une boutique vide", async () => {
    const centralToken = await login(app, centralEmail);
    const created = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${centralToken}`)
      .send({ code: `p7y-${suffix}`.slice(0, 16), name: "Boutique éphémère" })
      .expect(201);
    const storeId = created.body.id as string;

    const superToken = await login(app, superEmail);
    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeId}`)
      .set("Authorization", `Bearer ${superToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}`)
      .set("Authorization", `Bearer ${centralToken}`)
      .expect(404);
  });

  it("supprime plusieurs boutiques pour le super admin", async () => {
    const centralToken = await login(app, centralEmail);
    const superToken = await login(app, superEmail);
    const first = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${centralToken}`)
      .send({ code: `p7z1-${suffix}`.slice(0, 16), name: "Bulk 1" })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/api/v1/stores")
      .set("Authorization", `Bearer ${centralToken}`)
      .send({ code: `p7z2-${suffix}`.slice(0, 16), name: "Bulk 2" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post("/api/v1/stores/bulk-delete")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ ids: [first.body.id, second.body.id] })
      .expect(201);

    expect(response.body.deleted).toHaveLength(2);
    expect(response.body.skipped).toHaveLength(0);
  });

  it("lit et met à jour la fiche entrepôt", async () => {
    const token = await login(app, centralEmail);
    const list = await request(app.getHttpServer())
      .get("/api/v1/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    const central = list.body.items.find((row: { code: string }) => row.code === "CENTRAL");
    expect(central).toBeDefined();
    const previousAddress = central.address as string | null;

    await request(app.getHttpServer())
      .patch(`/api/v1/warehouses/${central.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ address: `Limete palier 7 ${suffix}` })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/warehouses/${central.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "INACTIVE" })
      .expect(409);

    await prisma.warehouse.update({
      where: { id: central.id },
      data: { address: previousAddress },
    });
  });
});
