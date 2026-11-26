import { HttpStatus } from "@nestjs/common";
import { ReferentialStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { CASH_REGISTER_ERROR } from "./cash-registers.constants";
import { CashRegistersService } from "./cash-registers.service";

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

const store = {
  id: "store-1",
  code: "GMB",
  name: "Boutique Gombe",
  status: ReferentialStatus.ACTIVE,
};

function register(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    storeId: "store-1",
    code: "C01",
    name: "Caisse principale",
    isDefault: true,
    status: ReferentialStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    store,
    ...overrides,
  };
}

describe("CashRegistersService", () => {
  const prisma = {
    store: { findUnique: jest.fn() },
    cashRegister: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  let service: CashRegistersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });
    service = new CashRegistersService(prisma as never, audit as never);
  });

  it("refuse un code déjà utilisé dans la boutique", async () => {
    prisma.store.findUnique.mockResolvedValue(store);
    prisma.cashRegister.findUnique.mockResolvedValue(register());

    await expect(
      service.create(actor, { storeId: "store-1", code: "c01", name: "Doublon" }, meta),
    ).rejects.toMatchObject({
      code: CASH_REGISTER_ERROR.CODE_TAKEN,
      status: HttpStatus.CONFLICT,
    });
  });

  it("crée une caisse et la rend par défaut si demandé", async () => {
    prisma.store.findUnique.mockResolvedValue(store);
    prisma.cashRegister.findUnique.mockResolvedValue(null);
    prisma.cashRegister.findFirst.mockResolvedValue(register());
    prisma.cashRegister.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashRegister.create.mockResolvedValue(register({ id: "reg-2", code: "C02", name: "Caisse 2", isDefault: true }));
    audit.write.mockResolvedValue(undefined);

    const result = await service.create(
      actor,
      { storeId: "store-1", code: "c02", name: "Caisse 2", isDefault: true },
      meta,
    );

    expect(prisma.cashRegister.updateMany).toHaveBeenCalledWith({
      where: { storeId: "store-1", isDefault: true },
      data: { isDefault: false },
    });
    expect(result.code).toBe("C02");
    expect(result.isDefault).toBe(true);
  });

  it("refuse de retirer la dernière caisse par défaut active", async () => {
    prisma.cashRegister.findUnique.mockResolvedValue(register());
    prisma.cashRegister.findFirst.mockResolvedValue(null);

    await expect(service.update(actor, "reg-1", { isDefault: false }, meta)).rejects.toMatchObject({
      code: CASH_REGISTER_ERROR.DEFAULT_REQUIRED,
      status: HttpStatus.CONFLICT,
    });
  });

  it("refuse de désactiver la dernière caisse par défaut", async () => {
    prisma.cashRegister.findUnique.mockResolvedValue(register());
    prisma.cashRegister.findFirst.mockResolvedValue(null);

    await expect(service.update(actor, "reg-1", { status: ReferentialStatus.INACTIVE }, meta)).rejects.toMatchObject({
      code: CASH_REGISTER_ERROR.DEFAULT_REQUIRED,
    });
  });
});
