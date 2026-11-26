import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/exceptions/api.exception";
import { LOGIN_HISTORY_ERROR } from "./login-histories.constants";
import { LoginHistoriesService } from "./login-histories.service";

const actor = {
  id: "admin-1",
  email: "admin@eyano.local",
  firstName: "Ada",
  lastName: "Kouassi",
  phone: null,
  status: "ACTIVE",
  role: { id: "role-1", code: "SUPER_ADMIN", name: "Super admin" },
  permissions: ["audit.read"],
  stores: [],
};

describe("LoginHistoriesService", () => {
  const prisma = {
    loginHistory: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: LoginHistoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    service = new LoginHistoriesService(prisma as never);
  });

  it("liste les tentatives les plus récentes", async () => {
    const createdAt = new Date("2026-11-22T12:00:00.000Z");
    prisma.loginHistory.findMany.mockResolvedValue([
      {
        id: "log-1",
        userId: actor.id,
        success: true,
        ip: "127.0.0.1",
        userAgent: "jest",
        createdAt,
        user: {
          id: actor.id,
          email: actor.email,
          firstName: actor.firstName,
          lastName: actor.lastName,
          role: { code: "SUPER_ADMIN", name: "Super admin" },
        },
      },
    ]);
    prisma.loginHistory.count.mockResolvedValue(1);

    const result = await service.list(actor as never, { page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      success: true,
      user: { email: actor.email },
    });
  });

  it("rejette un filtre utilisateur inconnu", async () => {
    prisma.user.count.mockResolvedValue(0);

    await expect(
      service.list(actor as never, { page: 1, pageSize: 20, userId: "00000000-0000-4000-8000-000000000099" }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: LOGIN_HISTORY_ERROR.USER_NOT_FOUND }),
    });
    await expect(
      service.list(actor as never, { page: 1, pageSize: 20, userId: "00000000-0000-4000-8000-000000000099" }),
    ).rejects.toBeInstanceOf(ApiException);
    await expect(
      service.list(actor as never, { page: 1, pageSize: 20, userId: "00000000-0000-4000-8000-000000000099" }),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it("calcule le résumé sécurité", async () => {
    prisma.loginHistory.count.mockResolvedValueOnce(12);
    prisma.loginHistory.count.mockResolvedValueOnce(10);
    prisma.loginHistory.count.mockResolvedValueOnce(2);
    prisma.loginHistory.count.mockResolvedValueOnce(5);
    prisma.loginHistory.count.mockResolvedValueOnce(3);
    prisma.loginHistory.count.mockResolvedValueOnce(1);

    const summary = await service.summary(actor as never);

    expect(summary).toEqual({
      todayTotal: 12,
      todaySuccess: 10,
      todayFailed: 2,
      last7DaysFailed: 5,
      failedLast24h: 3,
      unknownAttemptsToday: 1,
    });
  });
});