import { INestApplication } from "@nestjs/common";
import { ReferentialStatus } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P5_Userz";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Utilisateurs et permissions (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cleanup: { users: string[]; stores: string[] } = { users: [], stores: [] };

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const suffix = `${Date.now()}`;

    const roles = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "CASHIER" } }),
    ]);

    const storeA = await prisma.store.create({
      data: { code: `T5A-${suffix}`, name: `Boutique A ${suffix}`, status: ReferentialStatus.ACTIVE },
    });
    const storeB = await prisma.store.create({
      data: { code: `T5B-${suffix}`, name: `Boutique B ${suffix}`, status: ReferentialStatus.ACTIVE },
    });
    cleanup.stores.push(storeA.id, storeB.id);

    const cashier = await prisma.user.create({
      data: {
        email: `p5.cashier.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Caisse",
        lastName: "Test",
        status: "ACTIVE",
        roleId: roles[1].id,
      },
    });
    cleanup.users.push(cashier.id);

    await prisma.storeUser.create({
      data: { userId: cashier.id, storeId: storeA.id, isPrimary: true },
    });

    const central = await prisma.user.create({
      data: {
        email: `p5.central.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Central",
        lastName: "Admin",
        status: "ACTIVE",
        roleId: roles[0].id,
      },
    });
    cleanup.users.push(central.id);
  });

  afterAll(async () => {
    if (cleanup.users.length > 0) {
      await prisma.storeUser.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    if (cleanup.stores.length > 0) {
      await prisma.storeUser.deleteMany({ where: { storeId: { in: cleanup.stores } } });
      await prisma.store.deleteMany({ where: { id: { in: cleanup.stores } } });
    }
    await app.close();
  });

  it("refuse prices.update sans la permission", async () => {
    const email = cleanup.users[0] ? (await prisma.user.findUnique({ where: { id: cleanup.users[0] } }))?.email : "";
    const token = await login(app, email!);
    await request(app.getHttpServer())
      .get("/api/v1/pricing/policy-check")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("autorise prices.update pour l'administrateur central", async () => {
    const email = (await prisma.user.findUnique({ where: { id: cleanup.users[1] } }))?.email;
    const token = await login(app, email!);
    await request(app.getHttpServer())
      .get("/api/v1/pricing/policy-check")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("limite le caissier à ses boutiques sur une route scopée", async () => {
    const cashier = await prisma.user.findUnique({
      where: { id: cleanup.users[0] },
      include: { storeMemberships: true },
    });
    const storeA = cashier?.storeMemberships[0]?.storeId;
    const otherStore = cleanup.stores.find((id) => id !== storeA);
    const token = await login(app, cashier!.email);

    await request(app.getHttpServer())
      .get(`/api/v1/access-demo/store-scope?storeId=${storeA}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/access-demo/store-scope?storeId=${otherStore}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("liste les utilisateurs avec users.manage", async () => {
    const email = (await prisma.user.findUnique({ where: { id: cleanup.users[1] } }))?.email;
    const token = await login(app, email!);
    const response = await request(app.getHttpServer())
      .get("/api/v1/users?page=1&pageSize=10")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body.total).toBeGreaterThan(0);
    expect(Array.isArray(response.body.items)).toBe(true);
  });
});