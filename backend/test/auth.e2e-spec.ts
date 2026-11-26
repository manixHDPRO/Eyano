import { INestApplication } from "@nestjs/common";
import { JwtTokenService } from "../src/modules/auth/jwt-token.service";
import { UserStatus } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_Auth_P4x";

function cookieValue(setCookie: string[] | string | undefined, name: string): string | undefined {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const header of headers) {
    if (header.startsWith(`${name}=`)) {
      return header.split(";")[0]?.slice(name.length + 1);
    }
  }
  return undefined;
}

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids: string[] = [];

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);

    const role = await prisma.role.findUnique({ where: { code: "CENTRAL_ADMIN" } });
    if (!role) {
      throw new Error("Seed palier 2 requis : rôle CENTRAL_ADMIN introuvable.");
    }

    const passwordHash = await hashPassword(PASSWORD);
    const suffix = `${Date.now()}`;
    const users = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: `p4.ok.${suffix}@eyano.test`,
          passwordHash,
          firstName: "Palier",
          lastName: "Quatre",
          status: UserStatus.ACTIVE,
          roleId: role.id,
        },
      }),
      prisma.user.create({
        data: {
          email: `p4.lock.${suffix}@eyano.test`,
          passwordHash,
          firstName: "Lock",
          lastName: "Test",
          status: UserStatus.ACTIVE,
          roleId: role.id,
        },
      }),
    ]);
    ids.push(...users.map((user) => user.id));
  });

  afterAll(async () => {
    if (ids.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  });

  it("POST /auth/login réussit et pose un cookie httpOnly", async () => {
    const email = (await prisma.user.findUnique({ where: { id: ids[0] } }))?.email;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(email);
    const cookie = cookieValue(response.headers["set-cookie"], "eyano_refresh");
    expect(cookie).toBeTruthy();
    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=strict");
  });

  it("GET /auth/me exige un jeton, puis réussit", async () => {
    const email = (await prisma.user.findUnique({ where: { id: ids[0] } }))?.email;
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);

    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken as string}`)
      .expect(200);

    expect(me.body.user.id).toBe(ids[0]);
  });

  it("rejette un jeton d'accès expiré", async () => {
    const jwt = app.get(JwtTokenService);
    const expired = jwt.sign({ sub: ids[0], email: "p4@eyano.test", role: "CENTRAL_ADMIN" }, "1ms");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expired}`)
      .expect(401);

    expect(response.body.code).toBe("TOKEN_EXPIRED");
  });

  it("fait tourner le refresh et refuse la réutilisation", async () => {
    const email = (await prisma.user.findUnique({ where: { id: ids[0] } }))?.email;
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);

    const firstRefresh = cookieValue(login.headers["set-cookie"], "eyano_refresh");
    expect(firstRefresh).toBeTruthy();

    const rotated = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", `eyano_refresh=${firstRefresh}`)
      .expect(200);

    expect(rotated.body.accessToken).toEqual(expect.any(String));
    const secondRefresh = cookieValue(rotated.headers["set-cookie"], "eyano_refresh");
    expect(secondRefresh).toBeTruthy();
    expect(secondRefresh).not.toBe(firstRefresh);

    const reuse = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", `eyano_refresh=${firstRefresh}`)
      .expect(401);
    expect(reuse.body.code).toBe("REFRESH_REUSE");

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", `eyano_refresh=${secondRefresh}`)
      .expect(401);
  });

  it("logout invalide le refresh courant", async () => {
    const email = (await prisma.user.findUnique({ where: { id: ids[0] } }))?.email;
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const refresh = cookieValue(login.headers["set-cookie"], "eyano_refresh");

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${login.body.accessToken as string}`)
      .set("Cookie", `eyano_refresh=${refresh}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", `eyano_refresh=${refresh}`)
      .expect(401);
    expect(["REFRESH_INVALID", "REFRESH_REUSE"]).toContain(after.body.code);
  });

  it("POST /auth/change-password met à jour le mot de passe", async () => {
    const email = (await prisma.user.findUnique({ where: { id: ids[0] } }))?.email;
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const token = login.body.accessToken as string;
    const nextPassword = `${PASSWORD}_rotated`;

    await request(app.getHttpServer())
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: nextPassword })
      .expect(204);

    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(401);

    const relogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: nextPassword })
      .expect(200);
    expect(relogin.body.accessToken).toEqual(expect.any(String));

    const hash = await hashPassword(PASSWORD);
    await prisma.user.update({ where: { id: ids[0] }, data: { passwordHash: hash, passwordChangedAt: new Date() } });
  });

  it("change-password refuse un mot de passe actuel incorrect", async () => {
    const email = (await prisma.user.findUnique({ where: { id: ids[0] } }))?.email;
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${login.body.accessToken as string}`)
      .send({ currentPassword: "WrongCurrent!", newPassword: "NewPassword_12345" })
      .expect(400);

    expect(response.body.code).toBe("CURRENT_PASSWORD_INVALID");
  });

  it("verrouille le compte après N échecs", async () => {
    const lockUser = await prisma.user.findUnique({ where: { id: ids[1] } });
    const maxSetting = await prisma.appSetting.findUnique({ where: { key: "security.max_failed_logins" } });
    const maxFailed = typeof maxSetting?.value === "number" ? maxSetting.value : 5;

    for (let i = 0; i < maxFailed; i += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: lockUser?.email, password: "WrongPassword_1" })
        .expect(401);
    }

    const locked = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: lockUser?.email, password: PASSWORD })
      .expect(403);
    expect(locked.body.code).toBe("ACCOUNT_LOCKED");

    const persisted = await prisma.user.findUnique({ where: { id: ids[1] } });
    expect(persisted?.status).toBe(UserStatus.LOCKED);
    expect(persisted?.failedLoginCount).toBeGreaterThanOrEqual(maxFailed);
  });
});
