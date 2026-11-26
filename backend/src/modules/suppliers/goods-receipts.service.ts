import { HttpStatus, Injectable } from "@nestjs/common";
import {
  DocumentSequenceCode,
  GoodsReceiptStatus,
  Prisma,
  ProductStatus,
  ReferentialStatus,
  type GoodsReceipt,
  type GoodsReceiptItem,
} from "@prisma/client";
import { DocumentSequenceService } from "../../common/sequences/document-sequence.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { STOCK_SOURCE_TYPE } from "../stock-movements/stock-movements.constants";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import type { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import type { GoodsReceiptLineDto } from "./dto/goods-receipt-line.dto";
import type { ListGoodsReceiptsQueryDto } from "./dto/list-goods-receipts.query.dto";
import type { SetGoodsReceiptItemsDto } from "./dto/set-goods-receipt-items.dto";
import type { UpdateGoodsReceiptDto } from "./dto/update-goods-receipt.dto";
import { GOODS_RECEIPTS_ERROR } from "./goods-receipts.constants";

type PrismaTx = Prisma.TransactionClient;

export type GoodsReceiptLineSummary = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  quantity: number;
  unitCost: string;
  note: string | null;
};

export type GoodsReceiptListItem = {
  id: string;
  reference: string;
  status: GoodsReceiptStatus;
  supplier: { id: string; name: string };
  warehouse: { id: string; code: string; name: string };
  lineCount: number;
  totalQuantity: number;
  createdAt: string;
  validatedAt: string | null;
};

export type GoodsReceiptDetail = GoodsReceiptListItem & {
  note: string | null;
  receivedAt: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  validatedBy: { id: string; firstName: string; lastName: string } | null;
  items: GoodsReceiptLineSummary[];
  updatedAt: string;
};

export type GoodsReceiptValidateResult = GoodsReceiptDetail & {
  stock: Array<{ productId: string; quantityOnHand: number }>;
};

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly sequences: DocumentSequenceService,
    private readonly stockMovements: StockMovementsService,
  ) {}

  async list(query: ListGoodsReceiptsQueryDto) {
    const where: Prisma.GoodsReceiptWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    const search = query.search?.trim();
    if (search) {
      where.reference = { contains: search, mode: "insensitive" };
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }],
        include: {
          supplier: { select: { id: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          items: { select: { quantity: true } },
        },
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return {
      items: rows.map(toListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(id: string): Promise<GoodsReceiptDetail> {
    const receipt = await this.loadDetail(id);
    if (!receipt) {
      throw notFound();
    }
    return receipt;
  }

  async create(actor: AuthUser, dto: CreateGoodsReceiptDto, meta: RequestMeta): Promise<GoodsReceiptDetail> {
    await assertSupplierActive(this.prisma, dto.supplierId);
    await assertWarehouseActive(this.prisma, dto.warehouseId);
    if (dto.items) {
      assertUniqueProductLines(dto.items);
      await assertProductsExist(this.prisma, dto.items.map((line) => line.productId));
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const reference = await this.sequences.nextReference(DocumentSequenceCode.RECEIPT, tx);
      const header = await tx.goodsReceipt.create({
        data: {
          reference,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          note: dto.note?.trim() || null,
          status: GoodsReceiptStatus.DRAFT,
          createdById: actor.id,
        },
      });

      if (dto.items?.length) {
        await tx.goodsReceiptItem.createMany({
          data: dto.items.map((line) => ({
            goodsReceiptId: header.id,
            productId: line.productId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            note: line.note?.trim() || null,
          })),
        });
      }

      return header.id;
    });

    const detail = await this.loadDetail(created);
    if (!detail) {
      throw notFound();
    }

    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.GOODS_RECEIPT_CREATED,
      entityType: AUDIT_ENTITY.GOODS_RECEIPT,
      entityId: detail.id,
      newValue: { reference: detail.reference, status: detail.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return detail;
  }

  async update(actor: AuthUser, id: string, dto: UpdateGoodsReceiptDto, meta: RequestMeta): Promise<GoodsReceiptDetail> {
    const current = await this.requireDraft(id);
    if (dto.supplierId) {
      await assertSupplierActive(this.prisma, dto.supplierId);
    }
    if (dto.warehouseId) {
      await assertWarehouseActive(this.prisma, dto.warehouseId);
    }

    await this.prisma.goodsReceipt.update({
      where: { id },
      data: {
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        note: dto.note === undefined ? undefined : dto.note?.trim() || null,
      },
    });

    const detail = await this.loadDetail(id);
    if (!detail) {
      throw notFound();
    }

    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.GOODS_RECEIPT_UPDATED,
      entityType: AUDIT_ENTITY.GOODS_RECEIPT,
      entityId: id,
      oldValue: { reference: current.reference, status: current.status },
      newValue: { reference: detail.reference, status: detail.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return detail;
  }

  async setItems(actor: AuthUser, id: string, dto: SetGoodsReceiptItemsDto, meta: RequestMeta): Promise<GoodsReceiptDetail> {
    await this.requireDraft(id);
    assertUniqueProductLines(dto.items);
    await assertProductsExist(this.prisma, dto.items.map((line) => line.productId));

    await this.prisma.$transaction(async (tx) => {
      await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: id } });
      await tx.goodsReceiptItem.createMany({
        data: dto.items.map((line) => ({
          goodsReceiptId: id,
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          note: line.note?.trim() || null,
        })),
      });
    });

    const detail = await this.loadDetail(id);
    if (!detail) {
      throw notFound();
    }

    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.GOODS_RECEIPT_ITEMS_UPDATED,
      entityType: AUDIT_ENTITY.GOODS_RECEIPT,
      entityId: id,
      newValue: { lineCount: detail.items.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return detail;
  }

  async cancel(actor: AuthUser, id: string, meta: RequestMeta): Promise<GoodsReceiptDetail> {
    const current = await this.requireDraft(id);
    await this.prisma.goodsReceipt.update({
      where: { id },
      data: { status: GoodsReceiptStatus.CANCELLED },
    });

    const detail = await this.loadDetail(id);
    if (!detail) {
      throw notFound();
    }

    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.GOODS_RECEIPT_CANCELLED,
      entityType: AUDIT_ENTITY.GOODS_RECEIPT,
      entityId: id,
      oldValue: { status: current.status },
      newValue: { status: detail.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return detail;
  }

  async validate(actor: AuthUser, id: string, meta: RequestMeta): Promise<GoodsReceiptValidateResult> {
    const stockResults: Array<{ productId: string; quantityOnHand: number }> = [];

    const detail = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findUnique({
        where: { id },
        include: {
          items: true,
          supplier: true,
          warehouse: true,
        },
      });
      if (!receipt) {
        throw notFound();
      }
      if (receipt.status !== GoodsReceiptStatus.DRAFT) {
        throw new ApiException(
          GOODS_RECEIPTS_ERROR.NOT_DRAFT,
          "Seul un brouillon de réception peut être validé.",
          HttpStatus.CONFLICT,
        );
      }
      if (receipt.items.length === 0) {
        throw new ApiException(
          GOODS_RECEIPTS_ERROR.EMPTY_ITEMS,
          "Ajoutez au moins une ligne avant de valider.",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (receipt.supplier.status !== ReferentialStatus.ACTIVE) {
        throw new ApiException(
          GOODS_RECEIPTS_ERROR.SUPPLIER_INACTIVE,
          "Le fournisseur n'est plus actif.",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (receipt.warehouse.status !== ReferentialStatus.ACTIVE) {
        throw new ApiException(
          GOODS_RECEIPTS_ERROR.WAREHOUSE_INACTIVE,
          "L'entrepôt n'est pas actif.",
          HttpStatus.BAD_REQUEST,
        );
      }

      const transition = await tx.goodsReceipt.updateMany({
        where: { id, status: GoodsReceiptStatus.DRAFT },
        data: {
          status: GoodsReceiptStatus.VALIDATED,
          validatedById: actor.id,
          validatedAt: new Date(),
          receivedAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw new ApiException(
          GOODS_RECEIPTS_ERROR.VALIDATION_CONFLICT,
          "La réception a déjà été validée ou annulée.",
          HttpStatus.CONFLICT,
        );
      }

      const existingMovements = await tx.stockMovement.count({
        where: { sourceType: STOCK_SOURCE_TYPE.GOODS_RECEIPT, sourceId: id },
      });
      if (existingMovements > 0) {
        throw new ApiException(
          GOODS_RECEIPTS_ERROR.VALIDATION_CONFLICT,
          "Des mouvements de stock existent déjà pour cette réception.",
          HttpStatus.CONFLICT,
        );
      }

      for (const line of receipt.items) {
        const result = await this.stockMovements.recordGoodsReceiptIn(tx, {
          productId: line.productId,
          warehouseId: receipt.warehouseId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          goodsReceiptId: receipt.id,
          createdById: actor.id,
          note: line.note,
        });
        stockResults.push({ productId: line.productId, quantityOnHand: result.quantityOnHand });
      }

      return receipt.id;
    });

    const loaded = await this.loadDetail(detail);
    if (!loaded) {
      throw notFound();
    }

    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.GOODS_RECEIPT_VALIDATED,
      entityType: AUDIT_ENTITY.GOODS_RECEIPT,
      entityId: id,
      newValue: {
        reference: loaded.reference,
        lineCount: loaded.items.length,
        stock: stockResults,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ...loaded, stock: stockResults };
  }

  private async requireDraft(id: string): Promise<GoodsReceipt> {
    const receipt = await this.prisma.goodsReceipt.findUnique({ where: { id } });
    if (!receipt) {
      throw notFound();
    }
    if (receipt.status !== GoodsReceiptStatus.DRAFT) {
      throw new ApiException(
        GOODS_RECEIPTS_ERROR.NOT_DRAFT,
        "Seules les réceptions en brouillon peuvent être modifiées.",
        HttpStatus.CONFLICT,
      );
    }
    return receipt;
  }

  private async loadDetail(id: string): Promise<GoodsReceiptDetail | null> {
    const row = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          orderBy: { product: { reference: "asc" } },
          include: {
            product: { select: { id: true, reference: true, name: true } },
          },
        },
      },
    });
    if (!row) {
      return null;
    }
    return toDetail(row);
  }
}

function notFound(): ApiException {
  return new ApiException(GOODS_RECEIPTS_ERROR.NOT_FOUND, "Réception introuvable.", HttpStatus.NOT_FOUND);
}

function assertUniqueProductLines(items: GoodsReceiptLineDto[]): void {
  const seen = new Set<string>();
  for (const line of items) {
    if (seen.has(line.productId)) {
      throw new ApiException(
        GOODS_RECEIPTS_ERROR.DUPLICATE_PRODUCT,
        "Chaque produit ne peut figurer qu'une fois sur la réception.",
        HttpStatus.BAD_REQUEST,
      );
    }
    seen.add(line.productId);
  }
}

async function assertSupplierActive(client: PrismaService | PrismaTx, supplierId: string): Promise<void> {
  const supplier = await client.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.status !== ReferentialStatus.ACTIVE) {
    throw new ApiException(
      GOODS_RECEIPTS_ERROR.SUPPLIER_INACTIVE,
      "Fournisseur introuvable ou inactif.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

async function assertWarehouseActive(client: PrismaService | PrismaTx, warehouseId: string): Promise<void> {
  const warehouse = await client.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse || warehouse.status !== ReferentialStatus.ACTIVE) {
    throw new ApiException(
      GOODS_RECEIPTS_ERROR.WAREHOUSE_INACTIVE,
      "Entrepôt introuvable ou inactif.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

async function assertProductsExist(client: PrismaService | PrismaTx, productIds: string[]): Promise<void> {
  const distinct = [...new Set(productIds)];
  const found = await client.product.count({
    where: { id: { in: distinct }, status: { not: ProductStatus.ARCHIVED } },
  });
  if (found !== distinct.length) {
    throw new ApiException(
      GOODS_RECEIPTS_ERROR.PRODUCT_NOT_FOUND,
      "Un ou plusieurs produits sont introuvables.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

function toListItem(
  row: GoodsReceipt & {
    supplier: { id: string; name: string };
    warehouse: { id: string; code: string; name: string };
    items: Array<{ quantity: number }>;
  },
): GoodsReceiptListItem {
  const totalQuantity = row.items.reduce((sum, line) => sum + line.quantity, 0);
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    supplier: row.supplier,
    warehouse: row.warehouse,
    lineCount: row.items.length,
    totalQuantity,
    createdAt: row.createdAt.toISOString(),
    validatedAt: row.validatedAt?.toISOString() ?? null,
  };
}

function toDetail(
  row: GoodsReceipt & {
    supplier: { id: string; name: string };
    warehouse: { id: string; code: string; name: string };
    createdBy: { id: string; firstName: string; lastName: string };
    validatedBy: { id: string; firstName: string; lastName: string } | null;
    items: Array<
      GoodsReceiptItem & {
        product: { id: string; reference: string; name: string };
      }
    >;
  },
): GoodsReceiptDetail {
  const list = toListItem(row);
  return {
    ...list,
    note: row.note,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    validatedBy: row.validatedBy,
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((line) => ({
      id: line.id,
      productId: line.productId,
      productReference: line.product.reference,
      productName: line.product.name,
      quantity: line.quantity,
      unitCost: line.unitCost.toString(),
      note: line.note,
    })),
  };
}