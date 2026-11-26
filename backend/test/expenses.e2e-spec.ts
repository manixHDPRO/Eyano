import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_P17_Expenses";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Dépenses (palier 17)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  let token = "";
  let sessionId = "";
  let registerId = "";
  let storeId = "";
  const cleanup = {
    users: [] as string[],
    stores: [] as string[],
    expenses: [] as string[],
  };

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } });
    const email = `p17-exp-${suffix}@eyano.test`;
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName: "Exp", lastName: "Test", roleId: role.id, status: "ACTIVE" },
    });
    cleanup.users.push(user.id);
    token = await login(app, email);

    const store = await prisma.store.create({
      data: { code: `E17${suffix.slice(-5)}`, name: "Boutique dépenses", status: "ACTIVE" },
    });
    storeId = store.id;
    cleanup.stores.push(store.id);

    const register = await prisma.cashRegister.create({
      data: { storeId, code: "CE17", name: "Caisse dépenses", isDefault: true, status: "ACTIVE" },
    });
    registerId = register.id;

    const session = await request(app.getHttpServer())
      .post("/api/v1/cash-sessions/open")
      .set("Authorization", `Bearer ${token}`)
      .send({ cashRegisterId: registerId, openingFloatUsd: 100, openingFloatCdf: 50_000 })
      .expect(201);
    sessionId = session.body.id as string;
    expect(Number(session.body.theoreticalBalanceUsd)).toBe(100);
  });

  afterAll(async () => {
    if (cleanup.expenses.length) {
      await prisma.expense.deleteMany({ where: { id: { in: cleanup.expenses } } });
    }
    await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } }).catch(() => undefined);
    await prisma.cashRegister.delete({ where: { id: registerId } }).catch(() => undefined);
    await prisma.store.deleteMany({ where: { id: { in: cleanup.stores } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } }).catch(() => undefined);
    await app.close();
  });

  it("réduit le solde théorique lorsqu’une dépense est prélevée sur le tiroir", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        scopeType: "STORE",
        storeId,
        category: "TRANSPORT",
        amount: 15,
        currency: "USD",
        fromCashDrawer: true,
        cashSessionId: sessionId,
      })
      .expect(201);

    cleanup.expenses.push(created.body.id as string);
    expect(created.body.reference).toMatch(/^DP/);
    expect(created.body.fromCashDrawer).toBe(true);

    const current = await request(app.getHttpServer())
      .get(`/api/v1/cash-sessions/current?cashRegisterId=${registerId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Number(current.body.expensesUsd)).toBe(15);
    expect(Number(current.body.theoreticalBalanceUsd)).toBe(85);
    expect(Number(current.body.theoreticalBalanceCdf)).toBe(50_000);
  });

  it("hors tiroir : pas d’impact sur le solde théorique espèces", async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/cash-sessions/current?cashRegisterId=${registerId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const theoBefore = Number(before.body.theoreticalBalanceUsd);

    const created = await request(app.getHttpServer())
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        scopeType: "STORE",
        storeId,
        category: "OTHER",
        amount: 10,
        currency: "USD",
        fromCashDrawer: false,
      })
      .expect(201);

    cleanup.expenses.push(created.body.id as string);
    expect(created.body.fromCashDrawer).toBe(false);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/cash-sessions/current?cashRegisterId=${registerId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Number(after.body.theoreticalBalanceUsd)).toBe(theoBefore);
    expect(Number(after.body.expensesUsd)).toBe(15);
  });
});