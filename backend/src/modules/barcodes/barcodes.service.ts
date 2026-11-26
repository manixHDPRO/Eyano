import { HttpStatus, Injectable } from "@nestjs/common";
import {
  BarcodeSymbology,
  PrintContext,
  Prisma,
  ProductStatus,
  type Barcode,
  type Product,
} from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { isPrismaUniqueViolation } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { generateBarcodePayload, isCode128BCompatible, normalizeBarcodeCode } from "./barcode-code";
import {
  BARCODE_MAX_GENERATE_ATTEMPTS,
  BARCODE_MAX_MISSING_BATCH,
  BARCODES_ERROR,
} from "./barcodes.constants";
import { BarcodeCoverage, type ListBarcodesQueryDto } from "./dto/list-barcodes.query.dto";

type DbClient = Prisma.TransactionClient | PrismaService;

const barcodeSelect = {
  id: true,
  code: true,
  symbology: true,
  createdAt: true,
} as const;

const catalogInclude = {
  barcode: {
    select: {
      ...barcodeSelect,
      printLogs: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { createdAt: true },
      },
      _count: { select: { printLogs: true } },
    },
  },
} satisfies Prisma.ProductInclude;

type CatalogProduct = Product & {
  barcode:
    | (Pick<Barcode, "id" | "code" | "symbology" | "createdAt"> & {
        printLogs: { createdAt: Date }[];
        _count: { printLogs: number };
      })
    | null;
};

export type ProductBarcodeDto = {
  id: string;
  code: string;
  symbology: BarcodeSymbology;
  createdAt: string;
};

export type BarcodeCatalogItem = {
  id: string;
  reference: string;
  name: string;
  brand: string | null;
  photoUrl: string | null;
  status: ProductStatus;
  officialPrice: number;
  finalPrice: number;
  barcode: ProductBarcodeDto | null;
  printCount: number;
  lastPrintedAt: string | null;
  updatedAt: string;
};

export type BarcodePrintLogItem = {
  id: string;
  copies: number;
  context: PrintContext;
  createdAt: string;
  printedById: string;
  printedByName: string;
  barcode: ProductBarcodeDto;
  product: { id: string; reference: string; name: string };
};

type PrintLogRow = Prisma.BarcodePrintLogGetPayload<{
  include: {
    barcode: {
      include: {
        product: { select: { id: true; reference: true; name: true } };
      };
    };
    printer: { select: { firstName: true; lastName: true } };
  };
}>;

@Injectable()
export class BarcodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(actor: AuthUser, query: ListBarcodesQueryDto) {
    const where = this.buildCatalogWhere(actor, query);
    const skip = (query.page - 1) * query.pageSize;
    const catalogScope = catalogReadFilter(actor);

    const [total, rows, coded, all] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: catalogInclude,
      }),
      this.prisma.product.count({ where: { ...catalogScope, barcode: { isNot: null } } }),
      this.prisma.product.count({ where: catalogScope }),
    ]);

    return {
      items: rows.map((row) => this.toCatalogItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      stats: {
        total: all,
        coded,
        missing: Math.max(0, all - coded),
      },
    };
  }

  async lookup(actor: AuthUser, query: { code: string; storeId?: string }) {
    const code = normalizeBarcodeCode(query.code);
    const reference = query.code.trim();
    if (!code && !reference) {
      throw notFound();
    }

    const scope = catalogReadFilter(actor);
    const barcode = code
      ? await this.prisma.barcode.findFirst({
          where: {
            code: { equals: code, mode: "insensitive" },
            product: scope,
          },
          include: {
            product: true,
          },
        })
      : null;

    if (barcode) {
      return this.toLookupResult(barcode.product, barcode, query.storeId);
    }

    if (reference.length >= 2) {
      const product = await this.prisma.product.findFirst({
        where: {
          ...scope,
          reference: { equals: reference, mode: "insensitive" },
        },
        include: { barcode: true },
      });
      if (product) {
        return this.toLookupResult(product, product.barcode, query.storeId);
      }
    }

    throw notFound();
  }

  private async toLookupResult(
    product: Product,
    barcode: Barcode | null,
    storeId?: string,
  ): Promise<{
    product: {
      id: string;
      reference: string;
      name: string;
      status: ProductStatus;
      officialPrice: number;
      discountPercent: number;
      finalPrice: number;
      photoUrl: string | null;
    };
    barcode: ProductBarcodeDto | null;
    stock: { quantityOnHand: number; quantityAvailable: number } | null;
  }> {
    let stock: { quantityOnHand: number; quantityAvailable: number } | null = null;
    if (storeId) {
      const level = await this.prisma.stockLevel.findFirst({
        where: { productId: product.id, storeId, warehouseId: null },
        select: { quantityOnHand: true, quantityReserved: true },
      });
      const onHand = level?.quantityOnHand ?? 0;
      const reserved = level?.quantityReserved ?? 0;
      stock = {
        quantityOnHand: onHand,
        quantityAvailable: Math.max(0, onHand - reserved),
      };
    }

    return {
      product: {
        id: product.id,
        reference: product.reference,
        name: product.name,
        status: product.status,
        officialPrice: Number(product.officialPrice.toFixed(2)),
        discountPercent: Number(product.discountPercent.toFixed(2)),
        finalPrice: Number(product.finalPrice.toFixed(2)),
        photoUrl: toPublicPhotoUrl(product.photoPath),
      },
      barcode: barcode ? toBarcodeDto(barcode) : null,
      stock,
    };
  }

  async listPrintLogs(
    actor: AuthUser,
    query: { page: number; pageSize: number; productId?: string },
  ) {
    const where: Prisma.BarcodePrintLogWhereInput = {
      barcode: {
        product: {
          ...catalogReadFilter(actor),
          ...(query.productId ? { id: query.productId } : {}),
        },
      },
    };
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.barcodePrintLog.count({ where }),
      this.prisma.barcodePrintLog.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          barcode: {
            include: {
              product: { select: { id: true, reference: true, name: true } },
            },
          },
          printer: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.toPrintLogItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async ensureForProduct(
    client: DbClient,
    input: { productId: string; actorId: string; meta?: RequestMeta; audit?: boolean },
  ): Promise<Barcode> {
    const existing = await client.barcode.findUnique({ where: { productId: input.productId } });
    if (existing) {
      return existing;
    }
    return this.createUniqueBarcode(client, input);
  }

  async generateForProduct(actor: AuthUser, productId: string, meta: RequestMeta): Promise<BarcodeCatalogItem> {
    await this.assertProductWritable(actor, productId);
    const barcode = await this.prisma.$transaction(async (tx) => {
      return this.ensureForProduct(tx, {
        productId,
        actorId: actor.id,
        meta,
        audit: true,
      });
    });
    return this.loadCatalogItem(actor, barcode.productId);
  }

  async generateMissing(actor: AuthUser, meta: RequestMeta) {
    const products = await this.prisma.product.findMany({
      where: { barcode: null },
      select: { id: true },
      take: BARCODE_MAX_MISSING_BATCH,
      orderBy: { createdAt: "asc" },
    });
    if (products.length === 0) {
      return { generated: 0, items: [] as BarcodeCatalogItem[] };
    }

    const generatedIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const product of products) {
        const barcode = await this.ensureForProduct(tx, {
          productId: product.id,
          actorId: actor.id,
          meta,
          audit: true,
        });
        generatedIds.push(barcode.productId);
      }
    });

    const items = await this.prisma.product.findMany({
      where: { id: { in: generatedIds } },
      include: catalogInclude,
      orderBy: { name: "asc" },
    });
    return {
      generated: generatedIds.length,
      items: items.map((row) => this.toCatalogItem(row)),
    };
  }

  async print(actor: AuthUser, dto: { productIds: string[]; copies: number }, meta: RequestMeta) {
    const productIds = [...new Set(dto.productIds)];
    const copies = dto.copies;
    const context = productIds.length === 1 ? PrintContext.SINGLE : PrintContext.BATCH;

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, ...catalogReadFilter(actor) },
      include: catalogInclude,
    });
    if (products.length !== productIds.length) {
      throw productNotFound();
    }
    const missing = products.filter((product) => !product.barcode);
    if (missing.length > 0) {
      throw new ApiException(
        BARCODES_ERROR.MISSING,
        "Un ou plusieurs articles n’ont pas encore de code-barres. Générez-le avant d’imprimer.",
        HttpStatus.CONFLICT,
        { productIds: missing.map((product) => product.id) },
      );
    }

    const logs = await this.prisma.$transaction(async (tx) => {
      const created: PrintLogRow[] = [];
      for (const product of products) {
        const barcode = product.barcode;
        if (!barcode) {
          throw new ApiException(
            BARCODES_ERROR.MISSING,
            "Un ou plusieurs articles n’ont pas encore de code-barres. Générez-le avant d’imprimer.",
            HttpStatus.CONFLICT,
          );
        }
        const log = await tx.barcodePrintLog.create({
          data: {
            barcodeId: barcode.id,
            printedBy: actor.id,
            copies,
            context,
          },
          include: {
            barcode: {
              include: {
                product: { select: { id: true, reference: true, name: true } },
              },
            },
            printer: { select: { firstName: true, lastName: true } },
          },
        });
        created.push(log);
      }
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.BARCODE_PRINTED,
          entityType: AUDIT_ENTITY.BARCODE,
          entityId: products[0]?.barcode?.id ?? productIds[0],
          newValue: {
            productIds,
            copies,
            context,
            codes: products.map((product) => product.barcode?.code),
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      return created;
    });

    return {
      context,
      copies,
      items: products.map((row) => this.toCatalogItem(row)),
      logs: logs.map((row) => this.toPrintLogItem(row)),
    };
  }

  private async createUniqueBarcode(
    client: DbClient,
    input: { productId: string; actorId: string; meta?: RequestMeta; audit?: boolean },
  ): Promise<Barcode> {
    for (let attempt = 0; attempt < BARCODE_MAX_GENERATE_ATTEMPTS; attempt += 1) {
      const code = generateBarcodePayload();
      if (!isCode128BCompatible(code)) {
        continue;
      }
      try {
        const created = await client.barcode.create({
          data: {
            productId: input.productId,
            code,
            symbology: BarcodeSymbology.CODE128,
          },
        });
        if (input.audit !== false) {
          await this.audit.write(
            {
              actorId: input.actorId,
              action: AUDIT_ACTION.BARCODE_GENERATED,
              entityType: AUDIT_ENTITY.BARCODE,
              entityId: created.id,
              newValue: { productId: input.productId, code: created.code, symbology: created.symbology },
              ip: input.meta?.ip,
              userAgent: input.meta?.userAgent,
            },
            client,
          );
        }
        return created;
      } catch (error) {
        if (isPrismaUniqueViolation(error)) {
          const existing = await client.barcode.findUnique({ where: { productId: input.productId } });
          if (existing) {
            return existing;
          }
          continue;
        }
        throw error;
      }
    }
    throw new ApiException(
      BARCODES_ERROR.CODE_TAKEN,
      "Impossible d’allouer un code-barres unique. Réessayez.",
      HttpStatus.CONFLICT,
    );
  }

  private async assertProductWritable(actor: AuthUser, productId: string): Promise<void> {
    if (isCashier(actor)) {
      throw productNotFound();
    }
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      throw productNotFound();
    }
  }

  private async loadCatalogItem(actor: AuthUser, productId: string): Promise<BarcodeCatalogItem> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...catalogReadFilter(actor) },
      include: catalogInclude,
    });
    if (!product) {
      throw productNotFound();
    }
    return this.toCatalogItem(product);
  }

  private buildCatalogWhere(actor: AuthUser, query: ListBarcodesQueryDto): Prisma.ProductWhereInput {
    const filters: Prisma.ProductWhereInput[] = [catalogReadFilter(actor)];
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.coverage === BarcodeCoverage.CODED) {
      filters.push({ barcode: { isNot: null } });
    }
    if (query.coverage === BarcodeCoverage.MISSING) {
      filters.push({ barcode: null });
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      filters.push({
        OR: [
          { reference: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          { brand: { contains: term, mode: "insensitive" } },
          { barcode: { code: { contains: term, mode: "insensitive" } } },
        ],
      });
    }
    return { AND: filters };
  }

  private toCatalogItem(product: CatalogProduct): BarcodeCatalogItem {
    return {
      id: product.id,
      reference: product.reference,
      name: product.name,
      brand: product.brand,
      photoUrl: toPublicPhotoUrl(product.photoPath),
      status: product.status,
      officialPrice: Number(product.officialPrice.toFixed(2)),
      finalPrice: Number(product.finalPrice.toFixed(2)),
      barcode: product.barcode ? toBarcodeDto(product.barcode) : null,
      printCount: product.barcode?._count.printLogs ?? 0,
      lastPrintedAt: product.barcode?.printLogs[0]?.createdAt.toISOString() ?? null,
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private toPrintLogItem(row: PrintLogRow): BarcodePrintLogItem {
    return {
      id: row.id,
      copies: row.copies,
      context: row.context,
      createdAt: row.createdAt.toISOString(),
      printedById: row.printedBy,
      printedByName: `${row.printer.firstName} ${row.printer.lastName}`.trim(),
      barcode: toBarcodeDto(row.barcode),
      product: row.barcode.product,
    };
  }
}

function toPublicPhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) {
    return null;
  }
  return `/uploads/${photoPath.replace(/^\/+/, "")}`;
}

function toBarcodeDto(barcode: Pick<Barcode, "id" | "code" | "symbology" | "createdAt">): ProductBarcodeDto {
  return {
    id: barcode.id,
    code: barcode.code,
    symbology: barcode.symbology,
    createdAt: barcode.createdAt.toISOString(),
  };
}

function catalogReadFilter(actor: AuthUser): Prisma.ProductWhereInput {
  if (!isCashier(actor)) {
    return {};
  }
  const storeIds = actor.stores.map((store) => store.id);
  if (storeIds.length === 0) {
    return { id: { in: [] } };
  }
  return {
    status: ProductStatus.ACTIVE,
    productStores: {
      some: {
        isAuthorized: true,
        storeId: { in: storeIds },
      },
    },
  };
}

function isCashier(actor: AuthUser): boolean {
  return actor.role.code === "CASHIER";
}

function notFound(): ApiException {
  return new ApiException(BARCODES_ERROR.NOT_FOUND, "Code-barres introuvable.", HttpStatus.NOT_FOUND);
}

function productNotFound(): ApiException {
  return new ApiException(BARCODES_ERROR.PRODUCT_NOT_FOUND, "Produit introuvable.", HttpStatus.NOT_FOUND);
}
