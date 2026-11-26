import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_Settings_P19";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

describe("Paramètres (palier 19)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminEmail = "";
  let cashierEmail = "";
  const cleanupUsers: string[] = [];
  const testKey = "stock.alert_threshold_default";

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const suffix = `${Date.now()}`;

    const [adminRole, cashierRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "CASHIER" } }),
    ]);

    const admin = await prisma.user.create({
      data: {
        email: `p19.settings.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Settings",
        lastName: "Admin",
        status: "ACTIVE",
        roleId: adminRole.id,
      },
    });
    const cashier = await prisma.user.create({
      data: {
        email: `p19.cashier.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Caisse",
        lastName: "Settings",
        status: "ACTIVE",
        roleId: cashierRole.id,
      },
    });

    adminEmail = admin.email;
    cashierEmail = cashier.email;
    cleanupUsers.push(admin.id, cashier.id);
  });

  afterAll(async () => {
    if (cleanupUsers.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: cleanupUsers } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: cleanupUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUsers } } });
    }
    await app.close();
  });

  it("caissier reçoit 403 sur GET /settings", async () => {
    const token = await login(app, cashierEmail);
    const response = await request(app.getHttpServer())
      .get("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("admin lit les paramètres et obtient le préfixe ventes", async () => {
    const token = await login(app, adminEmail);
    const response = await request(app.getHttpServer())
      .get("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.saleNumberPrefix).toEqual(expect.any(String));
    expect(response.body).toHaveProperty("backup");
  });

  it("clé inconnue → 400", async () => {
    const token = await login(app, adminEmail);
    const response = await request(app.getHttpServer())
      .patch("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ updates: [{ key: "unknown.key.eyano.test", value: 1 }] })
      .expect(400);
    expect(response.body.code).toBe("SETTINGS_UNKNOWN_KEY");
  });

  it("modification non critique tracée puis restaurée", async () => {
    const token = await login(app, adminEmail);
    const before = await prisma.appSetting.findUniqueOrThrow({ where: { key: testKey } });
    const original = typeof before.value === "number" ? before.value : 100;
    const next = original === 100 ? 101 : 100;

    await request(app.getHttpServer())
      .patch("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ updates: [{ key: testKey, value: next }] })
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "SETTING_UPDATED", entityId: testKey },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();

    await request(app.getHttpServer())
      .patch("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ updates: [{ key: testKey, value: original }] })
      .expect(200);
  });
});