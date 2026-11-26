import { HttpStatus, Injectable } from "@nestjs/common";
import {
  BarcodeSymbology,
  CategoryStatus,
  Prisma,
  ProductStatus,
  ReferentialStatus,
  type Category,
  type Product,
} from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { emptyToNull, isPrismaUniqueViolation } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { ListProductsQueryDto } from "./dto/list-products.query.dto";
import type { SetProductStoresDto } from "./dto/set-product-stores.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import { BarcodesService } from "../barcodes/barcodes.service";
import { PricingLedgerService } from "../pricing/pricing-ledger.service";
import { ProductPhotosService } from "./product-photos.service";
import { jsonToNumber } from "../../common/utils/json-number";
import { SETTING_STOCK_ALERT_DEFAULT } from "../stock-movements/stock-movements.constants";
import {
  computeFinalPrice,
  isValidProductReference,
  moneyString,
  normalizeProductReference,
  PRODUCTS_ERROR,
} from "./products.constants";

const ALLOWED_STATUS_TRANSITIONS: Record<ProductStatus, readonly ProductStatus[]> = {
  DRAFT: [ProductStatus.ACTIVE, ProductStatus.ARCHIVED],
  ACTIVE: [ProductStatus.INACTIVE, ProductStatus.ARCHIVED],
  INACTIVE: [ProductStatus.ACTIVE, ProductStatus.ARCHIVED],
  ARCHIVED: [ProductStatus.DRAFT],
};

type ProductBarcode = {
  id: string;
  code: string;
  symbology: BarcodeSymbology;
  createdAt: Date;
};

type ProductRow = Product & {
  category: Category & { parent: { id: string; name: string } | null };
  barcode?: ProductBarcode | null;
  _count?: { productStores: number };
};

export type ProductCategoryRef = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
};

export type ProductAuthorizedStoreStock = {
  code: string;
  stock: number;
};

export type ProductListItem = {
  id: string;
  reference: string;
  name: string;
  brand: string | null;
  originCountry: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  purchasePrice: number;
  officialPrice: number;
  discountPercent: number;
  finalPrice: number;
  status: ProductStatus;
  category: ProductCategoryRef;
  authorizedStoreCount: number;
  alertThreshold: number | null;
  alertThresholdDisplay: number;
  warehouseStock: number;
  authorizedStores: ProductAuthorizedStoreStock[];
  barcode: {
    id: string;
    code: string;
    symbology: BarcodeSymbology;
    createdAt: string;
  } | null;
  updatedAt: string;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
  alertThreshold: number | null;
  createdById: string;
  createdAt: string;
};

export type ProductStoreAuthorization = {
  storeId: string;
  code: string;
  name: string;
  city: string | null;
  storeStatus: ReferentialStatus;
  isAuthorized: boolean;
};

export type ProductStoreAuthorizationList = {
  items: ProductStoreAuthorization[];
  authorizedCount: number;
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly photos: ProductPhotosService,
    private readonly pricingLedger: PricingLedgerService,
    private readonly barcodes: BarcodesService,
  ) {}

  async list(actor: AuthUser, query: ListProductsQueryDto) {
    const filters: Prisma.ProductWhereInput[] = [cashierCatalogFilter(actor)];
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.categoryId) {
      filters.push({
        OR: [{ categoryId: query.categoryId }, { category: { parentId: query.categoryId } }],
      });
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
    const where: Prisma.ProductWhereInput = { AND: filters };

    const skip = (query.page - 1) * query.pageSize;
    const catalogScope = cashierCatalogFilter(actor);
    const [total, rows, draft, active, inactive, archived] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: productInclude,
      }),
      this.prisma.product.count({ where: { ...catalogScope, status: ProductStatus.DRAFT } }),
      this.prisma.product.count({ where: { ...catalogScope, status: ProductStatus.ACTIVE } }),
      this.prisma.product.count({ where: { ...catalogScope, status: ProductStatus.INACTIVE } }),
      this.prisma.product.count({ where: { ...catalogScope, status: ProductStatus.ARCHIVED } }),
    ]);

    const items = rows.map((row) => this.toListItem(row));
    await this.attachCatalogStock(items, rows.map((row) => row.id));

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      stats: { draft, active, inactive, archived },
    };
  }

  async findOne(actor: AuthUser, id: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { id, ...cashierCatalogFilter(actor) },
      include: productInclude,
    });
    if (!product) {
      throw notFound();
    }
    return this.toDetail(product);
  }

  async listStoreAuthorizations(actor: AuthUser, id: string): Promise<ProductStoreAuthorizationList> {
    await this.assertProductReadable(actor, id);
    return this.loadStoreAuthorizations(id);
  }

  async setStoreAuthorizations(
    actor: AuthUser,
    id: string,
    dto: SetProductStoresDto,
    meta: RequestMeta,
  ): Promise<ProductStoreAuthorizationList> {
    if (isCashier(actor)) {
      throw notFound();
    }
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) {
      throw notFound();
    }

    const storeIds = [...new Set(dto.storeIds)];
    const stores = storeIds.length
      ? await this.prisma.store.findMany({ where: { id: { in: storeIds } } })
      : [];
    if (stores.length !== storeIds.length) {
      throw new ApiException(
        PRODUCTS_ERROR.STORE_NOT_FOUND,
        "Une ou plusieurs boutiques sont introuvables.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.prisma.productStore.findMany({ where: { productId: id } });
    const previouslyAuthorized = existing.filter((row) => row.isAuthorized).map((row) => row.storeId);
    const alreadyAuthorized = new Set(previouslyAuthorized);
    const newlyRequested = stores.filter((store) => !alreadyAuthorized.has(store.id));
    if (newlyRequested.some((store) => store.status !== ReferentialStatus.ACTIVE)) {
      throw new ApiException(
        PRODUCTS_ERROR.STORE_INACTIVE,
        "Seules les boutiques actives peuvent être autorisées.",
        HttpStatus.CONFLICT,
      );
    }

    const desired = new Set(storeIds);
    await this.prisma.$transaction(async (tx) => {
      for (const storeId of storeIds) {
        await tx.productStore.upsert({
          where: { productId_storeId: { productId: id, storeId } },
          create: {
            productId: id,
            storeId,
            isAuthorized: true,
            authorizedBy: actor.id,
          },
          update: {
            isAuthorized: true,
            authorizedBy: actor.id,
            authorizedAt: new Date(),
          },
        });
      }
      const toRevoke = existing.filter((row) => row.isAuthorized && !desired.has(row.storeId));
      if (toRevoke.length > 0) {
        await tx.productStore.updateMany({
          where: { id: { in: toRevoke.map((row) => row.id) } },
          data: { isAuthorized: false },
        });
      }
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.PRODUCT_STORES_UPDATED,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: id,
          oldValue: { storeIds: previouslyAuthorized },
          newValue: { storeIds },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.loadStoreAuthorizations(id);
  }

  async create(actor: AuthUser, dto: CreateProductDto, meta: RequestMeta): Promise<ProductDetail> {
    const reference = normalizeProductReference(dto.reference);
    if (!isValidProductReference(reference)) {
      throw invalidReference();
    }
    await this.assertReferenceAvailable(reference);
    const category = await this.assertLeafCategory(dto.categoryId);
    const purchasePrice = moneyString(dto.purchasePrice);
    const officialPrice = moneyString(dto.officialPrice);
    const discountPercent = moneyString(dto.discountPercent ?? 0);
    const finalPrice = computeFinalPrice(Number(officialPrice), Number(discountPercent));

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            reference,
            name: dto.name.trim(),
            categoryId: category.id,
            brand: emptyToNull(dto.brand),
            originCountry: emptyToNull(dto.originCountry),
            description: emptyToNull(dto.description),
            purchasePrice,
            officialPrice,
            discountPercent,
            finalPrice,
            alertThreshold: dto.alertThreshold ?? null,
            status: ProductStatus.DRAFT,
            createdById: actor.id,
          },
        });
        await this.pricingLedger.bootstrapOpenLines(tx, {
          productId: product.id,
          actorId: actor.id,
          purchasePrice,
          officialPrice,
          discountPercent,
        });
        await this.barcodes.ensureForProduct(tx, {
          productId: product.id,
          actorId: actor.id,
          meta,
          audit: true,
        });
        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.PRODUCT_CREATED,
            entityType: AUDIT_ENTITY.PRODUCT,
            entityId: product.id,
            newValue: productSnapshot(product),
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
        return product;
      });
      return this.findOne(actor, created.id);
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw referenceTaken();
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateProductDto, meta: RequestMeta): Promise<ProductDetail> {
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) {
      throw notFound();
    }
    if (isCashier(actor)) {
      throw notFound();
    }

    const nextReference =
      dto.reference !== undefined ? normalizeProductReference(dto.reference) : current.reference;
    if (!isValidProductReference(nextReference)) {
      throw invalidReference();
    }
    if (nextReference !== current.reference) {
      await this.assertReferenceAvailable(nextReference, id);
    }

    if (dto.categoryId && dto.categoryId !== current.categoryId) {
      await this.assertLeafCategory(dto.categoryId);
    }

    if (dto.status && dto.status !== current.status) {
      assertStatusTransition(current.status, dto.status);
      if (dto.status === ProductStatus.ACTIVE) {
        await this.assertLeafCategory(dto.categoryId ?? current.categoryId);
      }
    }

    const tariffTouched =
      dto.purchasePrice !== undefined || dto.officialPrice !== undefined || dto.discountPercent !== undefined;

    const data: Prisma.ProductUpdateInput = {
      ...(dto.reference !== undefined ? { reference: nextReference } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.categoryId !== undefined ? { category: { connect: { id: dto.categoryId } } } : {}),
      ...(dto.brand !== undefined ? { brand: emptyToNull(dto.brand) } : {}),
      ...(dto.originCountry !== undefined ? { originCountry: emptyToNull(dto.originCountry) } : {}),
      ...(dto.description !== undefined ? { description: emptyToNull(dto.description) } : {}),
      ...(dto.alertThreshold !== undefined ? { alertThreshold: dto.alertThreshold } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };

    const catalogTouched =
      dto.reference !== undefined ||
      dto.name !== undefined ||
      dto.categoryId !== undefined ||
      dto.brand !== undefined ||
      dto.originCountry !== undefined ||
      dto.description !== undefined ||
      dto.alertThreshold !== undefined ||
      dto.status !== undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (tariffTouched) {
          await this.pricingLedger.applyTariffChange({
            actor,
            productId: id,
            meta,
            purchasePrice: dto.purchasePrice,
            officialPrice: dto.officialPrice,
            discountPercent: dto.discountPercent,
            tx,
          });
        }
        let updated = tariffTouched
          ? await tx.product.findUniqueOrThrow({ where: { id } })
          : current;
        if (Object.keys(data).length > 0) {
          updated = await tx.product.update({ where: { id }, data });
        }
        if (catalogTouched) {
          await this.audit.write(
            {
              actorId: actor.id,
              action: AUDIT_ACTION.PRODUCT_UPDATED,
              entityType: AUDIT_ENTITY.PRODUCT,
              entityId: id,
              oldValue: productSnapshot(current),
              newValue: productSnapshot(updated),
              ip: meta.ip,
              userAgent: meta.userAgent,
            },
            tx,
          );
        }
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw referenceTaken();
      }
      throw error;
    }

    return this.findOne(actor, id);
  }

  async setPhoto(actor: AuthUser, id: string, file: Express.Multer.File, meta: RequestMeta): Promise<ProductDetail> {
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) {
      throw notFound();
    }
    const photoPath = await this.photos.store(id, file, current.photoPath);
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { photoPath } });
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.PRODUCT_PHOTO_UPDATED,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: id,
          oldValue: { photoPath: current.photoPath },
          newValue: { photoPath },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  async remove(
    actor: AuthUser,
    id: string,
    meta: RequestMeta,
  ): Promise<{ id: string; reference: string; name: string }> {
    const current = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            saleItems: true,
            stockMovements: true,
            goodsReceiptItems: true,
            transferItems: true,
            inventoryItems: true,
            internalStockIssues: true,
          },
        },
      },
    });
    if (!current) {
      throw notFound();
    }
    assertProductIdle(current._count);

    const liveStock = await this.prisma.stockLevel.count({
      where: {
        productId: id,
        OR: [{ quantityOnHand: { gt: 0 } }, { quantityReserved: { gt: 0 } }],
      },
    });
    if (liveStock > 0) {
      throw productInUse();
    }

    const summary = { id: current.id, reference: current.reference, name: current.name };
    await this.prisma.$transaction(async (tx) => {
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.PRODUCT_DELETED,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: id,
          oldValue: productSnapshot(current),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      await tx.barcodePrintLog.deleteMany({ where: { barcode: { productId: id } } });
      await tx.barcode.deleteMany({ where: { productId: id } });
      await tx.productStore.deleteMany({ where: { productId: id } });
      await tx.productPrice.deleteMany({ where: { productId: id } });
      await tx.productDiscount.deleteMany({ where: { productId: id } });
      await tx.stockLevel.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });
    await this.photos.remove(current.photoPath);
    return summary;
  }

  async clearPhoto(actor: AuthUser, id: string, meta: RequestMeta): Promise<ProductDetail> {
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) {
      throw notFound();
    }
    await this.photos.remove(current.photoPath);
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { photoPath: null } });
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.PRODUCT_PHOTO_UPDATED,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: id,
          oldValue: { photoPath: current.photoPath },
          newValue: { photoPath: null },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  private async assertReferenceAvailable(reference: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { reference } });
    if (existing && existing.id !== excludeId) {
      throw referenceTaken();
    }
  }

  private async assertLeafCategory(categoryId: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { children: true } } },
    });
    if (!category) {
      throw new ApiException(
        PRODUCTS_ERROR.CATEGORY_REQUIRED,
        "Catégorie introuvable.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (category.status === CategoryStatus.ARCHIVED) {
      throw new ApiException(
        PRODUCTS_ERROR.CATEGORY_ARCHIVED,
        "Cette catégorie est archivée.",
        HttpStatus.CONFLICT,
      );
    }
    if (category._count.children > 0) {
      throw new ApiException(
        PRODUCTS_ERROR.CATEGORY_NOT_LEAF,
        "Le produit doit être classé dans une sous-catégorie (nœud feuille), pas dans la catégorie parente.",
        HttpStatus.CONFLICT,
      );
    }
    return category;
  }

  private async assertProductReadable(actor: AuthUser, id: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id, ...cashierCatalogFilter(actor) },
      select: { id: true },
    });
    if (!product) {
      throw notFound();
    }
  }

  private async loadStoreAuthorizations(productId: string): Promise<ProductStoreAuthorizationList> {
    const [stores, links] = await Promise.all([
      this.prisma.store.findMany({
        where: {
          OR: [
            { status: ReferentialStatus.ACTIVE },
            { productStores: { some: { productId, isAuthorized: true } } },
          ],
        },
        orderBy: [{ name: "asc" }],
      }),
      this.prisma.productStore.findMany({ where: { productId } }),
    ]);
    const authorized = new Set(links.filter((row) => row.isAuthorized).map((row) => row.storeId));
    const items: ProductStoreAuthorization[] = stores.map((store) => ({
      storeId: store.id,
      code: store.code,
      name: store.name,
      city: store.city,
      storeStatus: store.status,
      isAuthorized: authorized.has(store.id),
    }));
    return { items, authorizedCount: items.filter((item) => item.isAuthorized).length };
  }

  private async attachCatalogStock(items: ProductListItem[], productIds: string[]): Promise<void> {
    if (productIds.length === 0) {
      return;
    }

    const [warehouse, thresholdSetting] = await Promise.all([
      this.prisma.warehouse.findFirst({ where: { code: "CENTRAL", status: ReferentialStatus.ACTIVE } }),
      this.prisma.appSetting.findUnique({ where: { key: SETTING_STOCK_ALERT_DEFAULT } }),
    ]);
    const defaultThreshold = jsonToNumber(thresholdSetting?.value, 100);

    const stockWhere: Prisma.StockLevelWhereInput = {
      productId: { in: productIds },
    };
    if (warehouse) {
      stockWhere.OR = [{ warehouseId: warehouse.id }, { storeId: { not: null } }];
    } else {
      stockWhere.storeId = { not: null };
    }

    const [stockLevels, authorizations] = await Promise.all([
      this.prisma.stockLevel.findMany({
        where: stockWhere,
        select: {
          productId: true,
          warehouseId: true,
          storeId: true,
          quantityOnHand: true,
        },
      }),
      this.prisma.productStore.findMany({
        where: { productId: { in: productIds }, isAuthorized: true },
        select: {
          productId: true,
          store: { select: { id: true, code: true } },
        },
        orderBy: { store: { code: "asc" } },
      }),
    ]);

    const warehouseStock = new Map<string, number>();
    const storeStock = new Map<string, number>();
    for (const row of stockLevels) {
      if (warehouse && row.warehouseId === warehouse.id) {
        warehouseStock.set(row.productId, row.quantityOnHand);
      }
      if (row.storeId) {
        storeStock.set(`${row.productId}:${row.storeId}`, row.quantityOnHand);
      }
    }

    const storesByProduct = new Map<string, ProductAuthorizedStoreStock[]>();
    for (const link of authorizations) {
      const bucket = storesByProduct.get(link.productId) ?? [];
      bucket.push({
        code: link.store.code,
        stock: storeStock.get(`${link.productId}:${link.store.id}`) ?? 0,
      });
      storesByProduct.set(link.productId, bucket);
    }

    for (const item of items) {
      item.warehouseStock = warehouseStock.get(item.id) ?? 0;
      item.alertThresholdDisplay = item.alertThreshold ?? defaultThreshold;
      item.authorizedStores = storesByProduct.get(item.id) ?? [];
    }
  }

  private toListItem(product: ProductRow): ProductListItem {
    return {
      id: product.id,
      reference: product.reference,
      name: product.name,
      brand: product.brand,
      originCountry: product.originCountry,
      photoPath: product.photoPath,
      photoUrl: this.photos.toPublicUrl(product.photoPath),
      purchasePrice: Number(product.purchasePrice.toFixed(2)),
      officialPrice: Number(product.officialPrice.toFixed(2)),
      discountPercent: Number(product.discountPercent.toFixed(2)),
      finalPrice: Number(product.finalPrice.toFixed(2)),
      status: product.status,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
        parentId: product.category.parentId,
        parentName: product.category.parent?.name ?? null,
      },
      authorizedStoreCount: product._count?.productStores ?? 0,
      alertThreshold: product.alertThreshold,
      alertThresholdDisplay: product.alertThreshold ?? 0,
      warehouseStock: 0,
      authorizedStores: [],
      barcode: product.barcode
        ? {
            id: product.barcode.id,
            code: product.barcode.code,
            symbology: product.barcode.symbology,
            createdAt: product.barcode.createdAt.toISOString(),
          }
        : null,
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private toDetail(product: ProductRow): ProductDetail {
    return {
      ...this.toListItem(product),
      description: product.description,
      alertThreshold: product.alertThreshold,
      createdById: product.createdById,
      createdAt: product.createdAt.toISOString(),
    };
  }
}

const productInclude = {
  category: { include: { parent: { select: { id: true, name: true } } } },
  barcode: { select: { id: true, code: true, symbology: true, createdAt: true } },
  _count: { select: { productStores: { where: { isAuthorized: true } } } },
} satisfies Prisma.ProductInclude;

function cashierCatalogFilter(actor: AuthUser): Prisma.ProductWhereInput {
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

function assertStatusTransition(from: ProductStatus, to: ProductStatus): void {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  if (allowed.includes(to)) {
    return;
  }
  throw new ApiException(
    PRODUCTS_ERROR.INVALID_STATUS,
    "Ce changement de statut n’est pas autorisé.",
    HttpStatus.CONFLICT,
    { from, to },
  );
}

function productSnapshot(product: Product) {
  return {
    id: product.id,
    reference: product.reference,
    name: product.name,
    categoryId: product.categoryId,
    status: product.status,
    purchasePrice: product.purchasePrice.toString(),
    officialPrice: product.officialPrice.toString(),
    discountPercent: product.discountPercent.toString(),
    finalPrice: product.finalPrice.toString(),
    photoPath: product.photoPath,
  };
}

function assertProductIdle(counts: {
  saleItems: number;
  stockMovements: number;
  goodsReceiptItems: number;
  transferItems: number;
  inventoryItems: number;
  internalStockIssues: number;
}): void {
  if (
    counts.saleItems > 0 ||
    counts.stockMovements > 0 ||
    counts.goodsReceiptItems > 0 ||
    counts.transferItems > 0 ||
    counts.inventoryItems > 0 ||
    counts.internalStockIssues > 0
  ) {
    throw productInUse();
  }
}

function productInUse(): ApiException {
  return new ApiException(
    PRODUCTS_ERROR.IN_USE,
    "Cet article a déjà du stock, des ventes ou des documents : archivez-le plutôt que de le supprimer.",
    HttpStatus.CONFLICT,
  );
}

function notFound(): ApiException {
  return new ApiException(PRODUCTS_ERROR.NOT_FOUND, "Produit introuvable.", HttpStatus.NOT_FOUND);
}

function referenceTaken(): ApiException {
  return new ApiException(
    PRODUCTS_ERROR.REFERENCE_TAKEN,
    "Cette référence article existe déjà.",
    HttpStatus.CONFLICT,
  );
}

function invalidReference(): ApiException {
  return new ApiException(
    PRODUCTS_ERROR.INVALID_REFERENCE,
    "La référence doit contenir 2 à 32 caractères (A-Z, 0-9, tiret).",
    HttpStatus.BAD_REQUEST,
  );
}
