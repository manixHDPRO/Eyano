import { HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtTokenService } from "./jwt-token.service";
import { UserStatus } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { AUTH_ERROR } from "./auth.constants";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";

const role = { id: "role-1", code: "CENTRAL_ADMIN", name: "Administrateur central" };

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@eyano.local",
    passwordHash: "encoded-hash",
    firstName: "Ada",
    lastName: "Kouassi",
    phone: null,
    status: UserStatus.ACTIVE,
    roleId: role.id,
    failedLoginCount: 0,
    lockedUntil: null,
    passwordChangedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    role,
    ...overrides,
  };
}

const settingsRows = [
  { key: "security.session_access_ttl_min", value: 15 },
  { key: "security.session_refresh_ttl_hours", value: 12 },
  { key: "security.max_failed_logins", value: 5 },
  { key: "security.lock_minutes", value: 15 },
];

const meta = { ip: "127.0.0.1", userAgent: "jest" };

describe("AuthService", () => {
  let service: AuthService;
  const prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    loginHistory: { create: jest.Mock };
    appSetting: { findMany: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  } = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    loginHistory: { create: jest.fn() },
    appSetting: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const jwt = { sign: jest.fn() };
  const passwords = { verify: jest.fn(), verifyDummy: jest.fn() };
  const access = {
    loadContext: jest.fn().mockResolvedValue({
      roleCode: "CENTRAL_ADMIN",
      permissions: ["users.manage"],
      storeIds: [],
      stores: [],
      isGlobalScope: true,
    }),
  };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === "auth.defaults") {
        return {
          accessTtlMinutes: 15,
          refreshTtlHours: 12,
          maxFailedLogins: 5,
          lockMinutes: 15,
        };
      }
      return fallback;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.appSetting.findMany.mockResolvedValue(settingsRows);
    prisma.loginHistory.create.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    jwt.sign.mockReturnValue("access.jwt");
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    );
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtTokenService,
      passwords as unknown as PasswordService,
      config as unknown as ConfigService,
      access as never,
      audit as never,
    );
  });

  it("connecte un utilisateur actif et émet une session", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    passwords.verify.mockResolvedValue(true);

    const session = await service.login("  User@eyano.local ", "secret", meta);

    expect(session.accessToken).toBe("access.jwt");
    expect(session.expiresIn).toBe(15 * 60);
    expect(session.user.email).toBe("user@eyano.local");
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(prisma.loginHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ success: true, userId: "user-1" }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
      }),
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "LOGIN_SUCCESS",
        entityType: "User",
      }),
    );
  });

  it("refuse un e-mail inconnu sans révéler l'absence du compte", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    passwords.verifyDummy.mockResolvedValue(false);

    await expect(service.login("ghost@eyano.local", "secret", meta)).rejects.toMatchObject({
      code: AUTH_ERROR.INVALID_CREDENTIALS,
      status: HttpStatus.UNAUTHORIZED,
    } as Partial<ApiException>);
    expect(passwords.verifyDummy).toHaveBeenCalled();
    expect(prisma.loginHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ success: false, userId: null }) }),
    );
  });

  it("incrémente les échecs et verrouille au cinquième", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ failedLoginCount: 4 }));
    passwords.verify.mockResolvedValue(false);

    await expect(service.login("user@eyano.local", "bad", meta)).rejects.toMatchObject({
      code: AUTH_ERROR.INVALID_CREDENTIALS,
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginCount: 5,
          status: UserStatus.LOCKED,
        }),
      }),
    );
  });

  it("refuse un compte encore verrouillé", async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        status: UserStatus.LOCKED,
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    );

    await expect(service.login("user@eyano.local", "secret", meta)).rejects.toMatchObject({
      code: AUTH_ERROR.ACCOUNT_LOCKED,
      status: HttpStatus.FORBIDDEN,
    });
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it("refuse un compte inactif", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ status: UserStatus.INACTIVE }));

    await expect(service.login("user@eyano.local", "secret", meta)).rejects.toMatchObject({
      code: AUTH_ERROR.ACCOUNT_INACTIVE,
    });
  });

  it("fait tourner le refresh et révoque l'ancien jeton", async () => {
    const current = {
      id: "rt-old",
      userId: "user-1",
      familyId: "fam-1",
      tokenHash: "hash",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma.$queryRaw.mockResolvedValue([{ id: current.id }]);
    prisma.refreshToken.findUnique.mockResolvedValue(current);
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-new" });

    const session = await service.refresh("raw-refresh-token", meta);

    expect(session.accessToken).toBe("access.jwt");
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-old" },
        data: expect.objectContaining({ replacedBy: "rt-new" }),
      }),
    );
  });

  it("révoque la famille si un refresh déjà révoqué est réutilisé", async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: "rt-old" }]);
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-old",
      familyId: "fam-1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.refresh("reused-token", meta)).rejects.toMatchObject({
      code: AUTH_ERROR.REFRESH_REUSE,
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: "fam-1", revokedAt: null },
      }),
    );
  });

  it("révoque le refresh courant à la déconnexion", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await service.logout("raw-refresh-token");

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });
});
