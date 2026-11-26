import { HttpStatus } from "@nestjs/common";
import { ReferentialStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { WAREHOUSE_ERROR } from "./warehouses.constants";
import { WarehousesService } from "./warehouses.service";

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

const warehouse = {
  id: "wh-1",
  code: "CENTRAL",
  name: "Entrepôt central",
  address: null,
  status: ReferentialStatus.ACTIVE,
  createdAt: now,
  updatedAt: now,
};

describe("WarehousesService", () => {
  const prisma = {
    warehouse: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  let service: WarehousesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });
    service = new WarehousesService(prisma as never, audit as never);
  });

  it("refuse de désactiver le dernier entrepôt actif", async () => {
    prisma.warehouse.findUnique.mockResolvedValue(warehouse);
    prisma.warehouse.count.mockResolvedValue(0);

    await expect(service.update(actor, "wh-1", { status: ReferentialStatus.INACTIVE }, meta)).rejects.toMatchObject({
      code: WAREHOUSE_ERROR.CANNOT_DEACTIVATE,
      status: HttpStatus.CONFLICT,
    });
  });

  it("met à jour la fiche et journalise", async () => {
    prisma.warehouse.findUnique.mockResolvedValue(warehouse);
    prisma.warehouse.update.mockResolvedValue({ ...warehouse, name: "Entrepôt Kinshasa", address: "Limete" });
    audit.write.mockResolvedValue(undefined);

    const result = await service.update(actor, "wh-1", { name: "Entrepôt Kinshasa", address: "Limete" }, meta);

    expect(result.name).toBe("Entrepôt Kinshasa");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WAREHOUSE_UPDATED", entityId: "wh-1" }),
      prisma,
    );
  });
});
