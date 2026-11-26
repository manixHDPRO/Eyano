import { AccessService } from "./access.service";

describe("AccessService", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  let service: AccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessService(prisma as never);
  });

  it("détecte le périmètre global", () => {
    expect(service.isGlobalRole("SUPER_ADMIN")).toBe(true);
    expect(service.isGlobalRole("CASHIER")).toBe(false);
  });

  it("refuse une boutique hors périmètre pour un caissier", async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: {
        code: "CASHIER",
        rolePermissions: [{ permission: { code: "stock.read" } }],
      },
      storeMemberships: [{ store: { id: "store-1", code: "A", name: "A" }, isPrimary: true }],
    });
    const context = await service.loadContext("user-1");
    expect(service.canAccessStore(context, "store-1")).toBe(true);
    expect(service.canAccessStore(context, "store-2")).toBe(false);
  });
});