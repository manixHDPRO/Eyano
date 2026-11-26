import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/exceptions/api.exception";
import { AUDIT_ACTION, AUDIT_ENTITY, AUDIT_ERROR } from "./audit-logs.constants";
import { AuditLogsService } from "./audit-logs.service";

const actor = {
  id: "admin-1",
  email: "admin@eyano.local",
  firstName: "Ada",
  lastName: "Kouassi",
  phone: null,
  status: "ACTIVE",
  role: { id: "role-1", code: "SUPER_ADMIN", name: "Super admin" },
  permissions: ["audit.read"],
  stores: [] as { id: string; code: string; name: string; isPrimary: boolean }[],
};

describe("AuditLogsService", () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const access = {
    loadContext: jest.fn(),
    canAccessStore: jest.fn(),
  };
  let service: AuditLogsService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.loadContext.mockResolvedValue({ isGlobalScope: true, storeIds: [] });
    access.canAccessStore.mockReturnValue(true);
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    service = new AuditLogsService(prisma as never, access as never);
  });

  it("écrit une ligne append-only", async () => {
    prisma.auditLog.create.mockResolvedValue({});
    await service.write({
      actorId: actor.id,
      action: AUDIT_ACTION.SETTING_UPDATED,
      entityType: AUDIT_ENTITY.APP_SETTING,
      entityId: "security.lock_minutes",
      oldValue: { key: "security.lock_minutes", value: 15 },
      newValue: { key: "security.lock_minutes", value: 20 },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AUDIT_ACTION.SETTING_UPDATED,
          entityType: AUDIT_ENTITY.APP_SETTING,
          entityId: "security.lock_minutes",
        }),
      }),
    );
  });

  it("liste les journaux les plus récents avec résumé", async () => {
    const createdAt = new Date("2026-11-22T10:00:00.000Z");
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        action: AUDIT_ACTION.SALE_VOIDED,
        entityType: AUDIT_ENTITY.SALE,
        entityId: "sale-1",
        storeId: "store-1",
        oldValue: null,
        newValue: { reason: "erreur caisse" },
        ip: "127.0.0.1",
        userAgent: "jest",
        createdAt,
        actor: { id: actor.id, email: actor.email, firstName: actor.firstName, lastName: actor.lastName },
        store: { id: "store-1", code: "BTQ-A", name: "Boutique A" },
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.list(actor, { page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0]?.action).toBe(AUDIT_ACTION.SALE_VOIDED);
    expect(result.items[0]?.sensitive).toBe(true);
    expect(result.items[0]?.summary).toContain("annulée");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    );
  });

  it("refuse une boutique hors périmètre", async () => {
    access.loadContext.mockResolvedValue({ isGlobalScope: false, storeIds: ["store-a"] });
    access.canAccessStore.mockReturnValue(false);

    await expect(service.list(actor, { page: 1, pageSize: 20, storeId: "store-b" })).rejects.toMatchObject({
      code: AUDIT_ERROR.FORBIDDEN_STORE,
      status: HttpStatus.FORBIDDEN,
    } as Partial<ApiException>);
  });
});
