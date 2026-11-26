import { HttpStatus, Injectable } from "@nestjs/common";
import {
  DocumentSequenceCode,
  NotificationType,
  Prisma,
  ProductStatus,
  ReferentialStatus,
  TransferStatus,
  type Transfer,
  type TransferItem,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import { DocumentSequenceService } from "../../common/sequences/document-sequence.service";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import type { CancelTransferDto } from "./dto/cancel-transfer.dto";
import type { CreateTransferDto } from "./dto/create-transfer.dto";
import type { ListTransfersQueryDto } from "./dto/list-transfers.query.dto";
import type { ReceiveTransferDto } from "./dto/receive-transfer.dto";
import type { SetTransferItemsDto } from "./dto/set-transfer-items.dto";
import type { ShipTransferDto } from "./dto/ship-transfer.dto";
import type { TransferCatalogQueryDto } from "./dto/transfer-catalog.query.dto";
import type { TransferLineDto } from "./dto/transfer-line.dto";
import type { UpdateTransferDto } from "./dto/update-transfer.dto";
import { TransferNotificationsService } from "./transfer-notifications.service";
import {
  CANCELABLE_STATUSES,
  SETTING_TRANSFER_REQUIRES_VALIDATION,
  TRANSFER_AUDIT,
  TRANSFER_AUDIT_ENTITY,
  TRANSFER_ERROR,
} from "./transfers.constants";

type PrismaTx = Prisma.TransactionClient;

const personSelect = { id: true, firstName: true, lastName: true } as const;
const placeSelect = { id: true, code: true, name: true } as const;

export type TransferLineSummary = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  quantityRequested: number;
  quantityShipped: number;
  quantityReceived: number;
  unitCost: string | null;
  variance: number | null;
};

export type TransferListLineItem = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  quantityRequested: number;
  quantityShipped: number;
  quantityReceived: number;
  /** Écart HD : expédié − reçu (manquant si positif). */
  discrepancy: number;
};

export type TransferListItem = {
  id: string;
  reference: string;
  status: TransferStatus;
  warehouse: { id: string; code: string; name: string };
  store: { id: string; code: string; name: string };
  lineCount: number;
  totalRequested: number;
  totalShipped: number;
  totalReceived: number;
  hasVariance: boolean;
  createdAt: string;
  validatedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  items: TransferListLineItem[];
};

export type TransferDetail = Omit<TransferListItem, "items"> & {
  note: string | null;
  cancelReason: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  validatedBy: { id: string; firstName: string; lastName: string } | null;
  shippedBy: { id: string; firstName: string; lastName: string } | null;
  receivedBy: { id: string; firstName: string; lastName: string } | null;
  cancelledAt: string | null;
  items: TransferLineSummary[];
  updatedAt: string;
};

export type TransferCatalogItem = {
  productId: string;
  reference: string;
  name: string;
  purchasePrice: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
};

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogsService,
    private readonly sequences: DocumentSequenceService,
    private readonly stockMovements: StockMovementsService,
    private readonly notifications: TransferNotificationsService,
  ) {}

  async summary(actor: AuthUser) {
    const scope = await this.buildScope(actor, {});
    const grouped = await this.prisma.transfer.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    });
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<
      TransferStatus,
      number
    >;
    const receivedRows = await this.prisma.transfer.findMany({
      where: {
        ...scope,
        status: { in: [TransferStatus.RECEIVED, TransferStatus.PARTIALLY_RECEIVED] },
      },
      select: {
        items: { select: { quantityShipped: true, quantityReceived: true } },
      },
    });
    const withVariance = receivedRows.filter((row) =>
      row.items.some((line) => line.quantityReceived !== line.quantityShipped),
    ).length;

    return {
      draft: counts.DRAFT ?? 0,
      pending: counts.PENDING ?? 0,
      validated: counts.VALIDATED ?? 0,
      preparing: counts.PREPARING ?? 0,
      shipped: counts.SHIPPED ?? 0,
      partiallyReceived: counts.PARTIALLY_RECEIVED ?? 0,
      received: counts.RECEIVED ?? 0,
      cancelled: counts.CANCELLED ?? 0,
      toPrepare: (counts.VALIDATED ?? 0) + (counts.PREPARING ?? 0),
      inTransit: (counts.SHIPPED ?? 0) + (counts.PARTIALLY_RECEIVED ?? 0),
      withVariance,
    };
  }

  async list(actor: AuthUser, query: ListTransfersQueryDto) {
    const scope = await this.buildScope(actor, query);
    const where: Prisma.TransferWhereInput = { ...scope };
    if (query.status) {
      where.status = query.status;
    }
    if (query.storeId) {
      where.storeId = query.storeId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { store: { name: { contains: search, mode: "insensitive" } } },
        { store: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }],
        include: {
          warehouse: { select: placeSelect },
          store: { select: placeSelect },
          items: {
            select: {
              id: true,
              productId: true,
              quantityRequested: true,
              quantityShipped: true,
              quantityReceived: true,
              product: { select: { reference: true, name: true } },
            },
          },
        },
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return {
      items: rows.map(toListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(actor: AuthUser, id: string): Promise<TransferDetail> {
    const detail = await this.loadDetail(id);
    if (!detail) {
      throw notFound();
    }
    await this.assertCanView(actor, detail.store.id);
    return detail;
  }

  async destinations(actor: AuthUser) {
    const context = await this.access.loadContext(actor.id);
    const where: Prisma.StoreWhereInput = { status: ReferentialStatus.ACTIVE };
    if (!context.isGlobalScope && actor.role.code !== "WAREHOUSE_MANAGER") {
      const storeIds = actor.stores.map((store) => store.id);
      where.id = { in: storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"] };
    }
    const items = await this.prisma.store.findMany({
      where,
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, name: true, city: true },
    });
    return { items };
  }

  async catalog(
    actor: AuthUser,
    query: TransferCatalogQueryDto,
  ): Promise<{ items: TransferCatalogItem[]; total: number; truncated: boolean }> {
    await this.assertCanView(actor, query.storeId);
    const search = query.search?.trim();
    const catalogWhere = this.buildTransferCatalogWhere(query.storeId, query.warehouseId, search);

    const rows = await this.prisma.productStore.findMany({
      where: catalogWhere,
      orderBy: { product: { name: "asc" } },
      include: {
        product: {
          select: {
            id: true,
            reference: true,
            name: true,
            purchasePrice: true,
            stockLevels: {
              where: { warehouseId: query.warehouseId, storeId: null },
              select: { quantityOnHand: true, quantityReserved: true },
            },
          },
        },
      },
    });

    const items = rows
      .map((row) => {
        const level = row.product.stockLevels[0];
        const onHand = level?.quantityOnHand ?? 0;
        const reserved = level?.quantityReserved ?? 0;
        return {
          productId: row.product.id,
          reference: row.product.reference,
          name: row.product.name,
          purchasePrice: row.product.purchasePrice.toString(),
          quantityOnHand: onHand,
          quantityReserved: reserved,
          quantityAvailable: onHand - reserved,
        };
      })
      .filter((item) => item.quantityAvailable > 0);

    return {
      total: items.length,
      truncated: false,
      items,
    };
  }

  private buildTransferCatalogWhere(
    storeId: string,
    warehouseId: string,
    search?: string,
  ): Prisma.ProductStoreWhereInput {
    return {
      storeId,
      isAuthorized: true,
      product: {
        status: ProductStatus.ACTIVE,
        stockLevels: {
          some: {
            warehouseId,
            storeId: null,
            quantityOnHand: { gt: 0 },
          },
        },
        ...(search
          ? {
              OR: [
                { reference: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    };
  }

  async create(actor: AuthUser, dto: CreateTransferDto, meta: RequestMeta): Promise<TransferDetail> {
    await this.assertCanMutateStore(actor, dto.storeId);
    await assertWarehouseActive(this.prisma, dto.warehouseId);
    await assertStoreActive(this.prisma, dto.storeId);
    if (dto.items?.length) {
      assertUniqueProductLines(dto.items);
      await this.assertProductsAuthorized(dto.storeId, dto.items.map((line) => line.productId));
    }

    if (dto.submitImmediately && (!dto.items?.length || dto.items.length === 0)) {
      throw emptyItems();
    }

    const createdId = await this.prisma.$transaction(async (tx) => {
      const reference = await this.sequences.nextReference(DocumentSequenceCode.TRANSFER, tx);
      const initialStatus = dto.submitImmediately ? TransferStatus.PENDING : TransferStatus.DRAFT;
      const header = await tx.transfer.create({
        data: {
          reference,
          warehouseId: dto.warehouseId,
          storeId: dto.storeId,
          note: dto.note?.trim() || null,
          status: initialStatus,
          createdById: actor.id,
        },
      });
      if (dto.items?.length) {
        await tx.transferItem.createMany({
          data: dto.items.map((line) => ({
            transferId: header.id,
            productId: line.productId,
            quantityRequested: line.quantityRequested,
            quantityShipped: line.quantityRequested,
          })),
        });
      }
      return header.id;
    });

    const detail = await this.requireDetail(createdId);
    if (dto.submitImmediately) {
      await this.notifications.notifyPending(this.prisma, {
        transferId: detail.id,
        reference: detail.reference,
        storeId: detail.store.id,
        storeName: detail.store.name,
      });
    }
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.CREATED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: detail.id,
      storeId: detail.store.id,
      newValue: { reference: detail.reference, status: detail.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async update(actor: AuthUser, id: string, dto: UpdateTransferDto, meta: RequestMeta): Promise<TransferDetail> {
    const current = await this.requireDraft(id);
    await this.assertCanMutateStore(actor, current.storeId);
    if (dto.storeId) {
      await this.assertCanMutateStore(actor, dto.storeId);
      await assertStoreActive(this.prisma, dto.storeId);
    }
    if (dto.warehouseId) {
      await assertWarehouseActive(this.prisma, dto.warehouseId);
    }

    const nextStoreId = dto.storeId ?? current.storeId;
    if (dto.storeId && dto.storeId !== current.storeId) {
      const items = await this.prisma.transferItem.findMany({ where: { transferId: id } });
      if (items.length) {
        await this.assertProductsAuthorized(
          nextStoreId,
          items.map((line) => line.productId),
        );
      }
    }

    await this.prisma.transfer.update({
      where: { id },
      data: {
        warehouseId: dto.warehouseId,
        storeId: dto.storeId,
        note: dto.note === undefined ? undefined : dto.note.trim() || null,
      },
    });

    const detail = await this.requireDetail(id);
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.UPDATED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      oldValue: { storeId: current.storeId, warehouseId: current.warehouseId },
      newValue: { storeId: detail.store.id, warehouseId: detail.warehouse.id },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async setItems(actor: AuthUser, id: string, dto: SetTransferItemsDto, meta: RequestMeta): Promise<TransferDetail> {
    const current = await this.requireDraft(id);
    await this.assertCanMutateStore(actor, current.storeId);
    assertUniqueProductLines(dto.items);
    await this.assertProductsAuthorized(
      current.storeId,
      dto.items.map((line) => line.productId),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.transferItem.deleteMany({ where: { transferId: id } });
      await tx.transferItem.createMany({
        data: dto.items.map((line) => ({
          transferId: id,
          productId: line.productId,
          quantityRequested: line.quantityRequested,
        })),
      });
    });

    const detail = await this.requireDetail(id);
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.ITEMS_UPDATED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      newValue: { lineCount: detail.items.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async submit(actor: AuthUser, id: string, meta: RequestMeta): Promise<TransferDetail> {
    const current = await this.requireDraft(id);
    await this.assertCanMutateStore(actor, current.storeId);
    const items = await this.prisma.transferItem.findMany({ where: { transferId: id } });
    if (items.length === 0) {
      throw emptyItems();
    }
    await this.assertProductsAuthorized(
      current.storeId,
      items.map((line) => line.productId),
    );

    await this.prisma.transfer.update({
      where: { id },
      data: { status: TransferStatus.PENDING },
    });

    const detail = await this.requireDetail(id);
    await this.notifications.notifyPending(this.prisma, {
      transferId: detail.id,
      reference: detail.reference,
      storeId: detail.store.id,
      storeName: detail.store.name,
    });
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.SUBMITTED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      oldValue: { status: current.status },
      newValue: { status: detail.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async validate(actor: AuthUser, id: string, meta: RequestMeta): Promise<TransferDetail> {
    const requiresValidation = await readBooleanSetting(this.prisma, SETTING_TRANSFER_REQUIRES_VALIDATION, true);

    await this.prisma.$transaction(async (tx) => {
      const transfer = await lockTransfer(tx, id);
      const allowedFrom: TransferStatus[] = requiresValidation
        ? [TransferStatus.PENDING]
        : [TransferStatus.DRAFT, TransferStatus.PENDING];
      if (!allowedFrom.includes(transfer.status)) {
        if (transfer.status === TransferStatus.DRAFT && requiresValidation) {
          throw new ApiException(
            TRANSFER_ERROR.VALIDATION_REQUIRED,
            "Ce transfert doit d'abord être soumis (brouillon → en attente) avant validation.",
            HttpStatus.CONFLICT,
          );
        }
        throw invalidStatus("Seuls les transferts en attente (ou brouillon si la validation n'est pas exigée) peuvent être validés.");
      }
      if (transfer.items.length === 0) {
        throw emptyItems();
      }
      await assertWarehouseActive(tx, transfer.warehouseId);
      await assertStoreActive(tx, transfer.storeId);
      await this.assertProductsAuthorized(
        transfer.storeId,
        transfer.items.map((line) => line.productId),
        tx,
      );

      const transition = await tx.transfer.updateMany({
        where: { id, status: transfer.status },
        data: {
          status: TransferStatus.VALIDATED,
          validatedById: actor.id,
          validatedAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw invalidStatus("Le transfert a déjà changé de statut.");
      }

      for (const line of transfer.items) {
        await this.stockMovements.reserveWarehouseQuantity(tx, {
          productId: line.productId,
          warehouseId: transfer.warehouseId,
          quantity: line.quantityRequested,
        });
      }
    });

    const detail = await this.requireDetail(id);
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.VALIDATED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      newValue: { reference: detail.reference, status: detail.status, reserved: detail.totalRequested },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async prepare(actor: AuthUser, id: string, meta: RequestMeta): Promise<TransferDetail> {
    const current = await this.prisma.transfer.findUnique({ where: { id } });
    if (!current) {
      throw notFound();
    }
    await this.assertCanView(actor, current.storeId);
    if (current.status !== TransferStatus.VALIDATED) {
      throw invalidStatus("Seul un transfert validé peut passer en préparation.");
    }
    await this.prisma.transfer.update({
      where: { id },
      data: { status: TransferStatus.PREPARING },
    });
    const detail = await this.requireDetail(id);
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.PREPARED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      oldValue: { status: current.status },
      newValue: { status: detail.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async ship(actor: AuthUser, id: string, dto: ShipTransferDto, meta: RequestMeta): Promise<TransferDetail> {
    await this.prisma.$transaction(async (tx) => {
      const transfer = await lockTransfer(tx, id);
      if (transfer.status !== TransferStatus.PREPARING && transfer.status !== TransferStatus.VALIDATED) {
        throw invalidStatus("Seuls les transferts validés ou en préparation peuvent être expédiés.");
      }
      const shippedByProduct = mapShippedQuantities(transfer.items, dto.items);
      const existingOut = await tx.stockMovement.count({
        where: { sourceType: "transfer", sourceId: id, movementType: "TRANSFER_OUT" },
      });
      if (existingOut > 0) {
        throw invalidStatus("Des mouvements d'expédition existent déjà pour ce transfert.");
      }

      for (const line of transfer.items) {
        const quantityShipped = shippedByProduct.get(line.productId) ?? line.quantityRequested;
        const product = await tx.product.findUniqueOrThrow({
          where: { id: line.productId },
          select: { purchasePrice: true },
        });
        await this.stockMovements.recordTransferOut(tx, {
          productId: line.productId,
          warehouseId: transfer.warehouseId,
          quantityShipped,
          quantityReservedRelease: line.quantityRequested,
          transferId: transfer.id,
          createdById: actor.id,
          unitCost: product.purchasePrice,
        });
        await tx.transferItem.update({
          where: { id: line.id },
          data: { quantityShipped, unitCost: product.purchasePrice },
        });
      }

      const transition = await tx.transfer.updateMany({
        where: { id, status: { in: [TransferStatus.PREPARING, TransferStatus.VALIDATED] } },
        data: {
          status: TransferStatus.SHIPPED,
          shippedById: actor.id,
          shippedAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw invalidStatus("Le transfert a déjà été expédié.");
      }
    });

    const detail = await this.requireDetail(id);
    await this.notifications.notifyShipped(this.prisma, {
      transferId: detail.id,
      reference: detail.reference,
      storeId: detail.store.id,
      storeName: detail.store.name,
      lineCount: detail.lineCount,
    });
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.SHIPPED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      newValue: { reference: detail.reference, status: detail.status, shipped: detail.totalShipped },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async receive(actor: AuthUser, id: string, dto: ReceiveTransferDto, meta: RequestMeta): Promise<TransferDetail> {
    await this.prisma.$transaction(async (tx) => {
      const transfer = await lockTransfer(tx, id);
      await this.assertCanReceive(actor, transfer.storeId);
      if (transfer.status !== TransferStatus.SHIPPED && transfer.status !== TransferStatus.PARTIALLY_RECEIVED) {
        throw invalidStatus("Seul un transfert expédié (ou partiellement reçu) peut être réceptionné.");
      }

      const complete = dto.complete !== false;
      const incoming = normalizeReceiveLines(dto.items);
      const itemsById = new Map(transfer.items.map((line) => [line.id, line]));
      const itemsByProduct = new Map(transfer.items.map((line) => [line.productId, line]));

      for (const line of incoming) {
        const target = line.transferItemId
          ? itemsById.get(line.transferItemId)
          : line.productId
            ? itemsByProduct.get(line.productId)
            : undefined;
        if (!target) {
          throw new ApiException(
            TRANSFER_ERROR.RECEIVE_QUANTITY,
            "Une ligne du bordereau de réception n'appartient pas à ce transfert.",
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const openLines = transfer.items.filter((line) => !isLineConfirmed(line, transfer.status));
      if (complete) {
        const incomingLineIds = new Set(
          incoming.map((line) => line.transferItemId ?? itemsByProduct.get(line.productId ?? "")?.id).filter(Boolean),
        );
        for (const line of openLines) {
          if (!incomingLineIds.has(line.id)) {
            throw new ApiException(
              TRANSFER_ERROR.RECEIVE_QUANTITY,
              "La réception finale doit porter sur toutes les lignes encore ouvertes.",
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      } else if (incoming.some((line) => line.quantityReceived <= 0)) {
        throw new ApiException(
          TRANSFER_ERROR.RECEIVE_QUANTITY,
          "Une réception partielle n'accepte que des quantités reçues strictement positives. Clôturez pour confirmer un zéro.",
          HttpStatus.BAD_REQUEST,
        );
      }

      for (const payload of incoming) {
        const line = payload.transferItemId
          ? itemsById.get(payload.transferItemId)
          : payload.productId
            ? itemsByProduct.get(payload.productId)
            : undefined;
        if (!line) {
          continue;
        }
        if (isLineConfirmed(line, transfer.status)) {
          throw new ApiException(
            TRANSFER_ERROR.LINE_ALREADY_RECEIVED,
            "Cette ligne a déjà été réceptionnée.",
            HttpStatus.CONFLICT,
          );
        }
        if (payload.quantityReceived > line.quantityShipped) {
          throw new ApiException(
            TRANSFER_ERROR.RECEIVE_QUANTITY,
            "Quantité réceptionnée invalide.",
            HttpStatus.BAD_REQUEST,
          );
        }
        if (payload.quantityReceived > 0) {
          if (line.unitCost == null) {
            throw invalidStatus("Coût unitaire manquant : l'expédition n'a pas figé le tarif.");
          }
          await this.stockMovements.recordTransferIn(tx, {
            productId: line.productId,
            storeId: transfer.storeId,
            quantity: payload.quantityReceived,
            transferId: transfer.id,
            createdById: actor.id,
            unitCost: line.unitCost,
          });
        }
        await tx.transferItem.update({
          where: { id: line.id },
          data: { quantityReceived: payload.quantityReceived },
        });
      }

      const refreshed = await tx.transferItem.findMany({ where: { transferId: id } });
      const hasDiscrepancy = refreshed.some((line) => line.quantityReceived !== line.quantityShipped);
      const allTouched =
        complete ||
        refreshed.every(
          (line) =>
            line.quantityReceived > 0 ||
            incoming.some(
              (row) =>
                row.transferItemId === line.id ||
                (row.productId === line.productId && row.quantityReceived >= 0),
            ),
        );
      let nextStatus: TransferStatus;
      if (complete) {
        nextStatus = hasDiscrepancy ? TransferStatus.PARTIALLY_RECEIVED : TransferStatus.RECEIVED;
      } else {
        nextStatus = allTouched ? TransferStatus.PARTIALLY_RECEIVED : TransferStatus.SHIPPED;
      }

      await tx.transfer.update({
        where: { id },
        data: {
          status: nextStatus,
          receivedById: actor.id,
          receivedAt:
            nextStatus === TransferStatus.RECEIVED || nextStatus === TransferStatus.PARTIALLY_RECEIVED
              ? new Date()
              : transfer.receivedAt,
        },
      });

      await tx.notification.updateMany({
        where: {
          entityType: "Transfer",
          entityId: id,
          type: NotificationType.TRANSFER_SHIPPED,
          readAt: null,
        },
        data: {
          readAt: new Date(),
          readById: actor.id,
        },
      });
    });

    const detail = await this.requireDetail(id);
    if (detail.status === TransferStatus.RECEIVED || detail.status === TransferStatus.PARTIALLY_RECEIVED) {
      const varianceLines = detail.items.filter((line) => line.quantityReceived !== line.quantityShipped);
      await this.notifications.notifyReceived(this.prisma, {
        transferId: detail.id,
        reference: detail.reference,
        storeId: detail.store.id,
        storeName: detail.store.name,
        hasVariance: varianceLines.length > 0,
        varianceSummary: formatVarianceSummary(varianceLines),
      });
    }
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.RECEIVED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      newValue: {
        status: detail.status,
        received: detail.totalReceived,
        shipped: detail.totalShipped,
        hasVariance: detail.hasVariance,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  async cancel(actor: AuthUser, id: string, dto: CancelTransferDto, meta: RequestMeta): Promise<TransferDetail> {
    const current = await this.prisma.transfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!current) {
      throw notFound();
    }
    if (!CANCELABLE_STATUSES.includes(current.status)) {
      throw new ApiException(
        TRANSFER_ERROR.CANCEL_FORBIDDEN,
        "Un transfert expédié ou réceptionné ne s'annule pas. Un retour physique passe par un ajustement justifié.",
        HttpStatus.CONFLICT,
      );
    }
    await this.assertCanCancel(actor, current);

    const reserved = current.status === TransferStatus.VALIDATED || current.status === TransferStatus.PREPARING;
    if (reserved && !dto.reason?.trim()) {
      throw new ApiException(
        TRANSFER_ERROR.CANCEL_REASON_REQUIRED,
        "Indiquez un motif pour annuler un transfert déjà réservé.",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await lockTransfer(tx, id);
      if (!CANCELABLE_STATUSES.includes(locked.status)) {
        throw new ApiException(
          TRANSFER_ERROR.CANCEL_FORBIDDEN,
          "Le transfert n'est plus annulable.",
          HttpStatus.CONFLICT,
        );
      }
      if (locked.status === TransferStatus.VALIDATED || locked.status === TransferStatus.PREPARING) {
        for (const line of locked.items) {
          await this.stockMovements.releaseWarehouseReservation(tx, {
            productId: line.productId,
            warehouseId: locked.warehouseId,
            quantity: line.quantityRequested,
          });
        }
      }
      const transition = await tx.transfer.updateMany({
        where: { id, status: locked.status },
        data: {
          status: TransferStatus.CANCELLED,
          cancelReason: dto.reason?.trim() || null,
          cancelledAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw invalidStatus("Le transfert a déjà changé de statut.");
      }
    });

    const detail = await this.requireDetail(id);
    await this.audit.write({
      actorId: actor.id,
      action: TRANSFER_AUDIT.CANCELLED,
      entityType: TRANSFER_AUDIT_ENTITY.TRANSFER,
      entityId: id,
      storeId: detail.store.id,
      oldValue: { status: current.status },
      newValue: { status: detail.status, cancelReason: detail.cancelReason },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return detail;
  }

  private async buildScope(
    actor: AuthUser,
    query: Pick<ListTransfersQueryDto, "storeId">,
  ): Promise<Prisma.TransferWhereInput> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      if (query.storeId) {
        return { storeId: query.storeId };
      }
      return {};
    }
    const storeIds = actor.stores.map((store) => store.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    if (query.storeId) {
      this.assertStoreAssigned(actor, query.storeId);
      return { storeId: query.storeId };
    }
    return { storeId: { in: storeIds } };
  }

  private async assertCanView(actor: AuthUser, storeId: string): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      return;
    }
    this.assertStoreAssigned(actor, storeId);
  }

  private async assertCanMutateStore(actor: AuthUser, storeId: string): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope) {
      return;
    }
    this.assertStoreAssigned(actor, storeId);
  }

  private async assertCanReceive(actor: AuthUser, storeId: string): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope) {
      return;
    }
    this.assertStoreAssigned(actor, storeId);
  }

  private async assertCanCancel(actor: AuthUser, transfer: Transfer): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope) {
      return;
    }
    if (transfer.status === TransferStatus.DRAFT || transfer.status === TransferStatus.PENDING) {
      this.assertStoreAssigned(actor, transfer.storeId);
      return;
    }
    throw new ApiException(
      TRANSFER_ERROR.FORBIDDEN_SCOPE,
      "L'annulation après validation est réservée à l'administration centrale.",
      HttpStatus.FORBIDDEN,
    );
  }

  private assertStoreAssigned(actor: AuthUser, storeId: string): void {
    if (!actor.stores.some((store) => store.id === storeId)) {
      throw new ApiException(
        TRANSFER_ERROR.FORBIDDEN_SCOPE,
        "Cette boutique ne fait pas partie de votre périmètre.",
        HttpStatus.FORBIDDEN,
        { storeId },
      );
    }
  }

  private async assertProductsAuthorized(
    storeId: string,
    productIds: string[],
    client: PrismaService | PrismaTx = this.prisma,
  ): Promise<void> {
    const distinct = [...new Set(productIds)];
    const products = await client.product.findMany({
      where: { id: { in: distinct }, status: { not: ProductStatus.ARCHIVED } },
      select: { id: true },
    });
    if (products.length !== distinct.length) {
      throw new ApiException(
        TRANSFER_ERROR.PRODUCT_NOT_FOUND,
        "Un ou plusieurs produits sont introuvables.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const authorized = await client.productStore.findMany({
      where: { storeId, productId: { in: distinct }, isAuthorized: true },
      select: { productId: true },
    });
    if (authorized.length !== distinct.length) {
      throw new ApiException(
        TRANSFER_ERROR.PRODUCT_NOT_AUTHORIZED,
        "Ce produit n'est pas autorisé à la vente dans cette boutique.",
        HttpStatus.CONFLICT,
      );
    }
  }

  private async requireDraft(id: string): Promise<Transfer> {
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer) {
      throw notFound();
    }
    if (transfer.status !== TransferStatus.DRAFT) {
      throw invalidStatus("Seuls les transferts en brouillon peuvent être modifiés.");
    }
    return transfer;
  }

  private async requireDetail(id: string): Promise<TransferDetail> {
    const detail = await this.loadDetail(id);
    if (!detail) {
      throw notFound();
    }
    return detail;
  }

  private async loadDetail(id: string): Promise<TransferDetail | null> {
    const row = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        warehouse: { select: placeSelect },
        store: { select: placeSelect },
        createdBy: { select: personSelect },
        validatedBy: { select: personSelect },
        shippedBy: { select: personSelect },
        receivedBy: { select: personSelect },
        items: {
          orderBy: { product: { reference: "asc" } },
          include: { product: { select: { id: true, reference: true, name: true } } },
        },
      },
    });
    if (!row) {
      return null;
    }
    return toDetail(row);
  }
}

async function lockTransfer(tx: PrismaTx, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM transfers WHERE id = ${id}::uuid FOR UPDATE
  `;
  if (!rows[0]) {
    throw notFound();
  }
  const transfer = await tx.transfer.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!transfer) {
    throw notFound();
  }
  return transfer;
}

function mapShippedQuantities(
  lines: TransferItem[],
  shipped?: Array<{ productId: string; quantityShipped: number }>,
): Map<string, number> {
  const result = new Map(lines.map((line) => [line.productId, line.quantityRequested]));
  if (!shipped?.length) {
    return result;
  }
  const seen = new Set<string>();
  for (const row of shipped) {
    if (seen.has(row.productId)) {
      throw new ApiException(
        TRANSFER_ERROR.DUPLICATE_PRODUCT,
        "Chaque produit ne peut figurer qu'une fois à l'expédition.",
        HttpStatus.BAD_REQUEST,
      );
    }
    seen.add(row.productId);
    const line = lines.find((item) => item.productId === row.productId);
    if (!line) {
      throw new ApiException(
        TRANSFER_ERROR.SHIP_QUANTITY,
        "Un produit du bordereau d'expédition n'appartient pas à ce transfert.",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (row.quantityShipped > line.quantityRequested) {
      throw new ApiException(
        TRANSFER_ERROR.SHIP_QUANTITY,
        "La quantité expédiée ne peut pas dépasser la quantité demandée.",
        HttpStatus.BAD_REQUEST,
      );
    }
    result.set(row.productId, row.quantityShipped);
  }
  return result;
}

type NormalizedReceiveLine = {
  transferItemId?: string;
  productId?: string;
  quantityReceived: number;
};

function normalizeReceiveLines(
  items: Array<{ transferItemId?: string; productId?: string; quantityReceived: number }>,
): NormalizedReceiveLine[] {
  const seen = new Set<string>();
  for (const line of items) {
    if (!line.transferItemId && !line.productId) {
      throw new ApiException(
        TRANSFER_ERROR.RECEIVE_QUANTITY,
        "Chaque ligne de réception doit référencer un article du bordereau.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const key = line.transferItemId ? `id:${line.transferItemId}` : `p:${line.productId}`;
    if (seen.has(key)) {
      throw new ApiException(
        TRANSFER_ERROR.DUPLICATE_PRODUCT,
        "Chaque ligne ne peut figurer qu'une fois à la réception.",
        HttpStatus.BAD_REQUEST,
      );
    }
    seen.add(key);
  }
  return items;
}

function isLineConfirmed(line: TransferItem, status: TransferStatus): boolean {
  if (status === TransferStatus.PARTIALLY_RECEIVED) {
    return line.quantityReceived > 0;
  }
  return false;
}

function formatVarianceSummary(lines: TransferLineSummary[]): string {
  if (lines.length === 0) {
    return "aucun écart";
  }
  return lines
    .map((line) => `${line.productReference} : reçu ${line.quantityReceived} / expédié ${line.quantityShipped}`)
    .join(" ; ");
}

function assertUniqueProductLines(items: TransferLineDto[]): void {
  const seen = new Set<string>();
  for (const line of items) {
    if (seen.has(line.productId)) {
      throw new ApiException(
        TRANSFER_ERROR.DUPLICATE_PRODUCT,
        "Chaque produit ne peut figurer qu'une fois sur le transfert.",
        HttpStatus.BAD_REQUEST,
      );
    }
    seen.add(line.productId);
  }
}

async function assertWarehouseActive(client: PrismaService | PrismaTx, warehouseId: string): Promise<void> {
  const warehouse = await client.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse || warehouse.status !== ReferentialStatus.ACTIVE) {
    throw new ApiException(
      TRANSFER_ERROR.WAREHOUSE_INACTIVE,
      "Entrepôt introuvable ou inactif.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

async function assertStoreActive(client: PrismaService | PrismaTx, storeId: string): Promise<void> {
  const store = await client.store.findUnique({ where: { id: storeId } });
  if (!store || store.status !== ReferentialStatus.ACTIVE) {
    throw new ApiException(TRANSFER_ERROR.STORE_INACTIVE, "Boutique introuvable ou inactive.", HttpStatus.BAD_REQUEST);
  }
}

async function readBooleanSetting(prisma: PrismaService, key: string, fallback: boolean): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row == null) {
    return fallback;
  }
  return row.value === true;
}

function notFound(): ApiException {
  return new ApiException(TRANSFER_ERROR.NOT_FOUND, "Transfert introuvable.", HttpStatus.NOT_FOUND);
}

function emptyItems(): ApiException {
  return new ApiException(
    TRANSFER_ERROR.EMPTY_ITEMS,
    "Ajoutez au moins une ligne avant de poursuivre.",
    HttpStatus.BAD_REQUEST,
  );
}

function invalidStatus(message: string): ApiException {
  return new ApiException(TRANSFER_ERROR.INVALID_STATUS, message, HttpStatus.CONFLICT);
}

function toListItem(
  row: Transfer & {
    warehouse: { id: string; code: string; name: string };
    store: { id: string; code: string; name: string };
    items: Array<{
      id: string;
      productId: string;
      quantityRequested: number;
      quantityShipped: number;
      quantityReceived: number;
      product: { reference: string; name: string };
    }>;
  },
): TransferListItem {
  const totalRequested = row.items.reduce((sum, line) => sum + line.quantityRequested, 0);
  const totalShipped = row.items.reduce((sum, line) => sum + line.quantityShipped, 0);
  const totalReceived = row.items.reduce((sum, line) => sum + line.quantityReceived, 0);
  const hasVariance =
    (row.status === TransferStatus.RECEIVED || row.status === TransferStatus.PARTIALLY_RECEIVED) &&
    row.items.some((line) => line.quantityReceived !== line.quantityShipped);
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    warehouse: row.warehouse,
    store: row.store,
    lineCount: row.items.length,
    totalRequested,
    totalShipped,
    totalReceived,
    hasVariance,
    createdAt: row.createdAt.toISOString(),
    validatedAt: row.validatedAt?.toISOString() ?? null,
    shippedAt: row.shippedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    items: row.items.map((line) => ({
      id: line.id,
      productId: line.productId,
      productReference: line.product.reference,
      productName: line.product.name,
      quantityRequested: line.quantityRequested,
      quantityShipped: line.quantityShipped,
      quantityReceived: line.quantityReceived,
      discrepancy: line.quantityShipped - line.quantityReceived,
    })),
  };
}

function toDetail(
  row: Transfer & {
    warehouse: { id: string; code: string; name: string };
    store: { id: string; code: string; name: string };
    createdBy: { id: string; firstName: string; lastName: string };
    validatedBy: { id: string; firstName: string; lastName: string } | null;
    shippedBy: { id: string; firstName: string; lastName: string } | null;
    receivedBy: { id: string; firstName: string; lastName: string } | null;
    items: Array<
      TransferItem & {
        product: { id: string; reference: string; name: string };
      }
    >;
  },
): TransferDetail {
  const list = toListItem(row);
  const shippedOrReceived =
    row.status === TransferStatus.SHIPPED ||
    row.status === TransferStatus.PARTIALLY_RECEIVED ||
    row.status === TransferStatus.RECEIVED;
  return {
    ...list,
    note: row.note,
    cancelReason: row.cancelReason,
    createdBy: row.createdBy,
    validatedBy: row.validatedBy,
    shippedBy: row.shippedBy,
    receivedBy: row.receivedBy,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((line) => ({
      id: line.id,
      productId: line.productId,
      productReference: line.product.reference,
      productName: line.product.name,
      quantityRequested: line.quantityRequested,
      quantityShipped: line.quantityShipped,
      quantityReceived: line.quantityReceived,
      unitCost: line.unitCost?.toString() ?? null,
      variance: shippedOrReceived ? line.quantityReceived - line.quantityShipped : null,
    })),
  };
}
