import { HttpStatus } from "@nestjs/common";
import { CategoryStatus, ProductStatus, ReferentialStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { computeFinalPrice } from "../../common/money";
import { PRODUCTS_ERROR } from "./products.constants";
import { ProductsService } from "./products.service";

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

function money(value: string) {
  return new Prisma.Decimal(value);
}

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cat-leaf",
    parentId: "cat-root",
    name: "Eaux",
    slug: "eaux",
    status: CategoryStatus.ACTIVE,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    parent: { id: "cat-root", name: "Boissons" },
    _count: { children: 0 },
    ...overrides,
  };
}

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    reference: "EAU-50CL",
    name: "Eau minérale 50 cl",
    categoryId: "cat-leaf",
    brand: "Virunga",
    originCountry: "RDC",
    description: null,
    photoPath: null,
    purchasePrice: money("0.40"),
    officialPrice: money("1.00"),
    discountPercent: money("0.00"),
    finalPrice: money("1.00"),
    alertThreshold: null,
    status: ProductStatus.DRAFT,
    createdById: actor.id,
    createdAt: now,
    updatedAt: now,
    category: categoryRow(),
    barcode: null,
    _count: { productStores: 0 },
    ...overrides,
  };
}

describe("computeFinalPrice", () => {
  it("applique la remise et arrondit à deux décimales", () => {
    expect(computeFinalPrice(50, 20)).toBe("40.00");
    expect(computeFinalPrice(10, 0)).toBe("10.00");
    expect(computeFinalPrice(8, 100)).toBe("0.00");
  });
});

describe("ProductsService", () => {
  const prisma = {
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    store: {
      findMany: jest.fn(),
    },
    productStore: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    productPrice: { deleteMany: jest.fn() },
    productDiscount: { deleteMany: jest.fn() },
    barcode: { deleteMany: jest.fn() },
    barcodePrintLog: { deleteMany: jest.fn() },
    stockLevel: { count: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    warehouse: { findFirst: jest.fn() },
    appSetting: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  const photos = {
    store: jest.fn(),
    remove: jest.fn(),
    toPublicUrl: jest.fn((path: string | null) => (path ? `/uploads/${path}` : null)),
  };
  const pricingLedger = {
    bootstrapOpenLines: jest.fn().mockResolvedValue(undefined),
    applyTariffChange: jest.fn().mockResolvedValue(undefined),
  };
  const barcodes = {
    ensureForProduct: jest.fn().mockResolvedValue({ id: "bc-1", code: "EY000000000001" }),
  };
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });
    service = new ProductsService(
      prisma as never,
      audit as never,
      photos as never,
      pricingLedger as never,
      barcodes as never,
    );
  });

  it("refuse une référence déjà utilisée", async () => {
    prisma.product.findUnique.mockResolvedValue(productRow());

    await expect(
      service.create(
        actor,
        {
          reference: "eau-50cl",
          name: "Autre eau",
          categoryId: "cat-leaf",
          purchasePrice: 0.4,
          officialPrice: 1,
        },
        meta,
      ),
    ).rejects.toMatchObject({
      code: PRODUCTS_ERROR.REFERENCE_TAKEN,
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.product.create).not.toHaveBeenCalled();
    expect(prisma.productStore.create).not.toHaveBeenCalled();
  });

  it("refuse un rattachement à une catégorie non feuille", async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.category.findUnique.mockResolvedValue(categoryRow({ id: "cat-root", parentId: null, _count: { children: 2 } }));

    await expect(
      service.create(
        actor,
        {
          reference: "EAU-50CL",
          name: "Eau minérale 50 cl",
          categoryId: "cat-root",
          purchasePrice: 0.4,
          officialPrice: 1,
        },
        meta,
      ),
    ).rejects.toMatchObject({
      code: PRODUCTS_ERROR.CATEGORY_NOT_LEAF,
      status: HttpStatus.CONFLICT,
    });
  });

  it("crée un brouillon sans aucune autorisation boutique", async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.category.findUnique.mockResolvedValue(categoryRow());
    prisma.product.create.mockResolvedValue(productRow());
    prisma.product.findFirst.mockResolvedValue(productRow());
    audit.write.mockResolvedValue(undefined);

    const result = await service.create(
      actor,
      {
        reference: "eau-50cl",
        name: "Eau minérale 50 cl",
        categoryId: "cat-leaf",
        brand: "Virunga",
        purchasePrice: 0.4,
        officialPrice: 1,
        discountPercent: 0,
      },
      meta,
    );

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reference: "EAU-50CL",
          status: ProductStatus.DRAFT,
          createdById: actor.id,
          finalPrice: "1.00",
        }),
      }),
    );
    expect(prisma.productStore.create).not.toHaveBeenCalled();
    expect(pricingLedger.bootstrapOpenLines).toHaveBeenCalled();
    expect(barcodes.ensureForProduct).toHaveBeenCalled();
    expect(result.authorizedStoreCount).toBe(0);
    expect(result.status).toBe(ProductStatus.DRAFT);
  });

  it("supprime un article sans historique opérationnel", async () => {
    prisma.product.findUnique.mockResolvedValue(
      productRow({
        _count: {
          productStores: 0,
          saleItems: 0,
          stockMovements: 0,
          goodsReceiptItems: 0,
          transferItems: 0,
          inventoryItems: 0,
          internalStockIssues: 0,
        },
      }),
    );
    prisma.stockLevel.count.mockResolvedValue(0);
    prisma.product.delete.mockResolvedValue(productRow());
    audit.write.mockResolvedValue(undefined);

    const result = await service.remove(actor, "prod-1", meta);

    expect(result).toEqual({ id: "prod-1", reference: "EAU-50CL", name: "Eau minérale 50 cl" });
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: "prod-1" } });
    expect(photos.remove).toHaveBeenCalledWith(null);
  });

  it("refuse la suppression si l’article a déjà des ventes", async () => {
    prisma.product.findUnique.mockResolvedValue(
      productRow({
        _count: {
          productStores: 0,
          saleItems: 2,
          stockMovements: 0,
          goodsReceiptItems: 0,
          transferItems: 0,
          inventoryItems: 0,
          internalStockIssues: 0,
        },
      }),
    );

    await expect(service.remove(actor, "prod-1", meta)).rejects.toMatchObject({
      code: PRODUCTS_ERROR.IN_USE,
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it("filtre le catalogue du caissier sur les boutiques autorisées", async () => {
    const cashier: AuthUser = {
      ...actor,
      role: { id: "role-c", code: "CASHIER", name: "Caissier" },
      permissions: ["products.read"],
      stores: [{ id: "store-1", code: "GX", name: "Gombe", isPrimary: true }],
    };
    prisma.product.count.mockResolvedValue(1);
    prisma.product.findMany.mockResolvedValue([productRow()]);
    prisma.warehouse.findFirst.mockResolvedValue({ id: "wh-central" });
    prisma.appSetting.findUnique.mockResolvedValue(null);
    prisma.stockLevel.findMany.mockResolvedValue([]);
    prisma.productStore.findMany.mockResolvedValue([]);

    await service.list(cashier, { page: 1, pageSize: 20 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              status: ProductStatus.ACTIVE,
              productStores: { some: { isAuthorized: true, storeId: { in: ["store-1"] } } },
            },
          ],
        },
      }),
    );
  });

  it("autorise des boutiques sans créer de stock", async () => {
    prisma.product.findUnique.mockResolvedValue({ id: "prod-1" });
    prisma.store.findMany
      .mockResolvedValueOnce([{ id: "store-1", status: ReferentialStatus.ACTIVE }])
      .mockResolvedValueOnce([
        {
          id: "store-1",
          code: "GX",
          name: "Gombe",
          city: "Kinshasa",
          status: ReferentialStatus.ACTIVE,
        },
      ]);
    prisma.productStore.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { productId: "prod-1", storeId: "store-1", isAuthorized: true },
    ]);
    prisma.productStore.upsert.mockResolvedValue({});

    const result = await service.setStoreAuthorizations(actor, "prod-1", { storeIds: ["store-1"] }, meta);

    expect(prisma.productStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_storeId: { productId: "prod-1", storeId: "store-1" } },
        create: expect.objectContaining({ isAuthorized: true, authorizedBy: actor.id }),
      }),
    );
    expect(prisma.productStore.updateMany).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PRODUCT_STORES_UPDATED",
        oldValue: { storeIds: [] },
        newValue: { storeIds: ["store-1"] },
      }),
      prisma,
    );
    expect(result.authorizedCount).toBe(1);
    expect(result.items[0]?.isAuthorized).toBe(true);
  });
});
