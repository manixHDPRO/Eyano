import { HttpStatus } from "@nestjs/common";
import { ReferentialStatus } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { StoresService } from "./stores.service";
import { STORES_ERROR } from "./stores.constants";

const actor: AuthUser = {
  id: "actor-1",
  email: "admin@eyano.test",
  firstName: "Ada",
  lastName: "Admin",
  phone: null,
  status: "ACTIVE",
  role: { id: "role-1", code: "CENTRAL_ADMIN", name: "Administrateur central" },
  permissions: ["stores.manage"],
  stores: [],
};

const meta = { ip: "127.0.0.1", userAgent: "jest" };
const now = new Date("2026-11-18T10:00:00.000Z");

function storeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "store-1",
    code: "GMB",
    name: "Boutique Gombe",
    address: "Av. du Commerce",
    city: "Kinshasa",
    phone: null,
    status: ReferentialStatus.ACTIVE,
    receiptHeader: "Eyano Gombe",
    receiptFooter: "Merci",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function registerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    storeId: "store-1",
    code: "C01",
    name: "Caisse principale",
    isDefault: true,
    status: ReferentialStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("StoresService", () => {
  const prisma = {
    store: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    cashRegister: {
      create: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  let service: StoresService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });
    service = new StoresService(prisma as never, audit as never);
  });

  it("refuse un code boutique déjà utilisé", async () => {
    prisma.store.findUnique.mockResolvedValue(storeRow());

    await expect(service.create(actor, { code: "gmb", name: "Autre" }, meta)).rejects.toMatchObject({
      code: STORES_ERROR.CODE_TAKEN,
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.store.create).not.toHaveBeenCalled();
  });

  it("crée la boutique avec une caisse par défaut C01", async () => {
    prisma.store.findUnique.mockResolvedValue(null);
    prisma.store.create.mockResolvedValue(storeRow());
    prisma.cashRegister.create.mockResolvedValue(registerRow());
    audit.write.mockResolvedValue(undefined);

    const result = await service.create(actor, { code: "gmb", name: "Boutique Gombe" }, meta);

    expect(prisma.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "GMB", name: "Boutique Gombe", status: ReferentialStatus.ACTIVE }),
      }),
    );
    expect(prisma.cashRegister.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storeId: "store-1",
          code: "C01",
          name: "Caisse principale",
          isDefault: true,
        }),
      }),
    );
    expect(audit.write).toHaveBeenCalled();
    expect(result.cashRegisters).toHaveLength(1);
    expect(result.cashRegisters[0]?.isDefault).toBe(true);
    expect(result.code).toBe("GMB");
  });

  it("refuse de changer vers un code déjà pris", async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce(storeRow())
      .mockResolvedValueOnce(storeRow({ id: "store-2", code: "LMB" }));

    await expect(service.update(actor, "store-1", { code: "LMB" }, meta)).rejects.toBeInstanceOf(ApiException);
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it("met à jour le statut et journalise", async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce(storeRow())
      .mockResolvedValueOnce({
        ...storeRow({ status: ReferentialStatus.INACTIVE }),
        cashRegisters: [registerRow()],
        _count: { cashRegisters: 1, storeUsers: 0 },
      });
    prisma.store.update.mockResolvedValue(storeRow({ status: ReferentialStatus.INACTIVE }));

    const result = await service.update(actor, "store-1", { status: ReferentialStatus.INACTIVE }, meta);

    expect(result.status).toBe(ReferentialStatus.INACTIVE);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "STORE_UPDATED", entityId: "store-1" }),
      prisma,
    );
  });
});
