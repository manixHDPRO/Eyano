import { HttpStatus } from "@nestjs/common";
import { BarcodeSymbology, PrintContext, ProductStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { BARCODES_ERROR } from "./barcodes.constants";
import { BarcodesService } from "./barcodes.service";
import { BarcodeCoverage } from "./dto/list-barcodes.query.dto";

const actor: AuthUser = {
  id: "actor-1",
  email: "admin@eyano.test",
  firstName: "Ada",
  lastName: "Admin",
  phone: null,
  status: "ACTIVE",
  role: { id: "role-1", code: "CENTRAL_ADMIN", name: "Administrateur central" },
  permissions: ["products.manage", "barcodes.print"],
  stores: [],
};

const meta = { ip: "127.0.0.1", userAgent: "jest" };
const now = new Date("2026-11-19T10:00:00.000Z");

function money(value: string) {
  return new Prisma.Decimal(value);
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
    barcode: barcodeRow(),
    ...overrides,
  };
}

function barcodeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bc-1",
    productId: "prod-1",
    code: "EY123456",
    symbology: BarcodeSymbology.CODE128,
    createdAt: now,
    printLogs: [],
    _count: { printLogs: 0 },
    ...overrides,
  };
}

describe("BarcodesService", () => {
  const prisma = {
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    barcode: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    barcodePrintLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  let service: BarcodesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });
    service = new BarcodesService(prisma as never, audit as never);
  });

  it("n’émet pas un second code si le produit en a déjà un", async () => {
    const existing = barcodeRow();
    prisma.product.findUnique.mockResolvedValue({ id: "prod-1" });
    prisma.barcode.findUnique.mockResolvedValue(existing);
    prisma.product.findFirst.mockResolvedValue(productRow());

    const result = await service.generateForProduct(actor, "prod-1", meta);

    expect(prisma.barcode.create).not.toHaveBeenCalled();
    expect(result.barcode?.code).toBe("EY123456");
  });

  it("refuse d’imprimer un article sans code", async () => {
    prisma.product.findMany.mockResolvedValue([productRow({ barcode: null })]);

    await expect(service.print(actor, { productIds: ["prod-1"], copies: 1 }, meta)).rejects.toMatchObject({
      code: BARCODES_ERROR.MISSING,
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.barcodePrintLog.create).not.toHaveBeenCalled();
  });

  it("journalise une réimpression sans régénérer le code", async () => {
    const product = productRow();
    prisma.product.findMany.mockResolvedValue([product]);
    prisma.barcodePrintLog.create.mockResolvedValue({
      id: "log-1",
      barcodeId: "bc-1",
      printedBy: actor.id,
      copies: 3,
      context: PrintContext.SINGLE,
      createdAt: now,
      barcode: { ...barcodeRow(), product: { id: "prod-1", reference: "EAU-50CL", name: "Eau minérale 50 cl" } },
      printer: { firstName: "Ada", lastName: "Admin" },
    });
    audit.write.mockResolvedValue(undefined);

    const result = await service.print(actor, { productIds: ["prod-1"], copies: 3 }, meta);

    expect(prisma.barcode.create).not.toHaveBeenCalled();
    expect(prisma.barcodePrintLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barcodeId: "bc-1",
          copies: 3,
          context: PrintContext.SINGLE,
          printedBy: actor.id,
        }),
      }),
    );
    expect(result.copies).toBe(3);
    expect(result.context).toBe(PrintContext.SINGLE);
    expect(result.items[0]?.barcode?.code).toBe("EY123456");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BARCODE_PRINTED" }),
      prisma,
    );
  });

  it("marque un lot d’impression comme BATCH", async () => {
    const second = productRow({
      id: "prod-2",
      reference: "EAU-1L",
      barcode: barcodeRow({ id: "bc-2", productId: "prod-2", code: "EY999999999999" }),
    });
    prisma.product.findMany.mockResolvedValue([productRow(), second]);
    prisma.barcodePrintLog.create
      .mockResolvedValueOnce({
        id: "log-1",
        copies: 1,
        context: PrintContext.BATCH,
        createdAt: now,
        printedBy: actor.id,
        barcode: { ...barcodeRow(), product: { id: "prod-1", reference: "EAU-50CL", name: "Eau" } },
        printer: { firstName: "Ada", lastName: "Admin" },
      })
      .mockResolvedValueOnce({
        id: "log-2",
        copies: 1,
        context: PrintContext.BATCH,
        createdAt: now,
        printedBy: actor.id,
        barcode: {
          ...barcodeRow({ id: "bc-2", code: "EY999999999999" }),
          product: { id: "prod-2", reference: "EAU-1L", name: "Eau 1L" },
        },
        printer: { firstName: "Ada", lastName: "Admin" },
      });

    const result = await service.print(actor, { productIds: ["prod-1", "prod-2"], copies: 1 }, meta);
    expect(result.context).toBe(PrintContext.BATCH);
    expect(prisma.barcodePrintLog.create).toHaveBeenCalledTimes(2);
  });

  it("filtre la liste sur les articles sans code", async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.product.findMany.mockResolvedValue([]);

    await service.list(actor, { page: 1, pageSize: 16, coverage: BarcodeCoverage.MISSING });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{}, { barcode: null }] },
      }),
    );
  });
});
