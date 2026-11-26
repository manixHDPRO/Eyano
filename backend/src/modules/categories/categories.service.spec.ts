import { HttpStatus } from "@nestjs/common";
import { CategoryStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { CATEGORIES_ERROR } from "./categories.constants";
import { CategoriesService } from "./categories.service";
import { slugifyCategoryName } from "./slug";

const actor: AuthUser = {
  id: "actor-1",
  email: "admin@eyano.test",
  firstName: "Ada",
  lastName: "Admin",
  phone: null,
  status: "ACTIVE",
  role: { id: "role-1", code: "CENTRAL_ADMIN", name: "Administrateur central" },
  permissions: ["products.manage"],
  stores: [],
};

const meta = { ip: "127.0.0.1", userAgent: "jest" };
const now = new Date("2026-11-18T10:00:00.000Z");

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cat-root",
    parentId: null,
    name: "Boissons",
    slug: "boissons",
    status: CategoryStatus.ACTIVE,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    _count: { products: 0, children: 0 },
    ...overrides,
  };
}

describe("slugifyCategoryName", () => {
  it("normalise les accents et espaces", () => {
    expect(slugifyCategoryName("Épicerie sucrée")).toBe("epicerie-sucree");
  });
});

describe("CategoriesService", () => {
  const prisma = {
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  let service: CategoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });
    prisma.product.groupBy.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);
    prisma.category.findFirst.mockResolvedValue(null);
    service = new CategoriesService(prisma as never, audit as never);
  });

  it("refuse un troisième niveau de catégorie", async () => {
    prisma.category.findUnique.mockResolvedValue(
      categoryRow({
        id: "cat-child",
        parentId: "cat-root",
        name: "Eaux",
        slug: "eaux",
      }),
    );

    await expect(service.create(actor, { name: "Eaux plates", parentId: "cat-child" }, meta)).rejects.toMatchObject({
      code: CATEGORIES_ERROR.DEPTH_EXCEEDED,
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it("refuse une sous-catégorie si le parent a déjà des produits", async () => {
    prisma.category.findUnique.mockResolvedValue(categoryRow({ _count: { products: 2, children: 0 } }));

    await expect(service.create(actor, { name: "Eaux", parentId: "cat-root" }, meta)).rejects.toMatchObject({
      code: CATEGORIES_ERROR.PARENT_HAS_PRODUCTS,
      status: HttpStatus.CONFLICT,
    });
  });

  it("crée une racine avec slug et journalise", async () => {
    const created = categoryRow();
    prisma.category.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...created,
        parent: null,
        children: [],
        _count: { products: 0, children: 0 },
      });
    prisma.category.create.mockResolvedValue(created);
    audit.write.mockResolvedValue(undefined);

    const result = await service.create(actor, { name: "Boissons" }, meta);

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Boissons",
          slug: "boissons",
          parentId: null,
          status: CategoryStatus.ACTIVE,
        }),
      }),
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CATEGORY_CREATED", entityId: "cat-root" }),
      prisma,
    );
    expect(result.name).toBe("Boissons");
    expect(result.depth).toBe(1);
  });

  it("refuse de supprimer une catégorie encore liée à des produits", async () => {
    prisma.category.findUnique.mockResolvedValue(categoryRow({ _count: { products: 1, children: 0 } }));

    await expect(service.remove(actor, "cat-root", meta)).rejects.toMatchObject({
      code: CATEGORIES_ERROR.HAS_PRODUCTS,
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });
});
