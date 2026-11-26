import { HttpStatus, Injectable } from "@nestjs/common";
import {
  DocumentSequenceCode,
  InventoryStatus,
  MovementDirection,
  Prisma,
  ProductStatus,
  ReferentialStatus,
  ScopeType,
  type InventoryItem,
  type InventorySession,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import { DocumentSequenceService } from "../../common/sequences/document-sequence.service";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import type { CancelInventoryDto } from "./dto/cancel-inventory.dto";
import type { CreateInventoryDto } from "./dto/create-inventory.dto";
import type { ListInventoriesQueryDto } from "./dto/list-inventories.query.dto";
import type { PatchInventoryItemsDto } from "./dto/patch-inventory-items.dto";
import type { UpdateInventoryDto } from "./dto/update-inventory.dto";
import { aggregateMovementBreakdown, buildFrozenSnapshot } from "./inventory-breakdown.util";
import { InventoryNotificationsService } from "./inventory-notifications.service";
import {
  INVENTORY_AUDIT,
  INVENTORY_AUDIT_ENTITY,
  INVENTORY_ERROR,
  OPEN_INVENTORY_STATUSES,
  SETTING_INVENTORY_REQUIRES_JUSTIFICATION,
} from "./inventory.constants";

type PrismaTx = Prisma.TransactionClient;

const personSelect = { id: true, firstName: true, lastName: true } as const;
const placeSelect = { id: true, code: true, name: true } as const;

export type InventoryLine = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  theoreticalQty: number;
  physicalQty: number | null;
  variance: number | null;
  justification: string | null;
  initialQty: number;
  receiptsQty: number;
  transfersInQty: number;
  transfersOutQty: number;
  salesQty: number;
  internalIssuesQty: number;
  adjustmentsQty: number;
};

export type InventoryListItem = {
  id: string;
  reference: string;
  status: InventoryStatus;
  scopeType: ScopeType;
  warehouse: { id: string; code: string; name: string } | null;
  store: { id: string; code: string; name: string } | null;
  lineCount: number;
  countedLines: number;
  varianceLines: number;
  totalVarianceUnits: number;
  startedAt: string | null;
  validatedAt: string | null;
  closedAt: string | null;
};

export type InventoryDetail = InventoryListItem & {
  note: string | null;
  startedBy: { id: string; firstName: string; lastName: string };
  validatedBy: { id: string; firstName: string; lastName: string } | null;
  items: InventoryLine[];
  updatedAt: string;
};

export type InventoryLocationOption = {
  scopeType: ScopeType;
  warehouse?: { id: string; code: string; name: string };
  store?: { id: string; code: string; name: string; city: string | null };
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogsService,
    private readonly sequences: DocumentSequenceService,
    private readonly stockMovements: StockMovementsService,
    private readonly notifications: InventoryNotificationsService,
  ) {}

  async summary(actor: AuthUser) {
    const scope = await this.buildScope(actor, {});
    const grouped = await this.prisma.inventorySession.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    });
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<
      InventoryStatus,
      number
    >;
    const pending = await this.prisma.inventorySession.findMany({
      where: { ...scope, status: InventoryStatus.PENDING_VALIDATION },
      select: { items: { select: { variance: true, physicalQty: true, theoreticalQty: true } } },
    });
    const withVariance = pending.filter((session) =>
      session.items.some(
        (line) => line.physicalQty !== null && line.variance !== null && line.variance !== 0,
      ),
    ).length;

    return {
      draft: counts.DRAFT ?? 0,
      inProgress: counts.IN_PROGRESS ?? 0,
      pendingValidation: counts.PENDING_VALIDATION ?? 0,
      validated: counts.VALIDATED ?? 0,
      cancelled: counts.CANCELLED ?? 0,
      open: (counts.DRAFT ?? 0) + (counts.IN_PROGRESS ?? 0) + (counts.PENDING_VALIDATION ?? 0),
      withVariance,
    };
  }

  async locations(actor: AuthUser): Promise<{ items: InventoryLocationOption[] }> {
    const context = await this.access.loadContext(actor.id);
    const items: InventoryLocationOption[] = [];

    if (context.isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      const warehouses = await this.prisma.warehouse.findMany({
        where: { status: ReferentialStatus.ACTIVE },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true },
      });
      for (const warehouse of warehouses) {
        items.push({ scopeType: ScopeType.WAREHOUSE, warehouse });
      }
    }

    if (context.isGlobalScope) {
      const stores = await this.prisma.store.findMany({
        where: { status: ReferentialStatus.ACTIVE },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true, city: true },
      });
      for (const store of stores) {
        items.push({ scopeType: ScopeType.STORE, store });
      }
    } else if (actor.role.code !== "WAREHOUSE_MANAGER") {
      const storeIds = actor.stores.map((store) => store.id);
      if (storeIds.length) {
        const stores = await this.prisma.store.findMany({
          where: { id: { in: storeIds }, status: ReferentialStatus.ACTIVE },
          orderBy: [{ code: "asc" }],
          select: { id: true, code: true, name: true, city: true },
        });
        for (const store of stores) {
          items.push({ scopeType: ScopeType.STORE, store });
        }
      }
    }

    return { items };
  }

  async list(actor: AuthUser, query: ListInventoriesQueryDto) {
    const scope = await this.buildScope(actor, query);
    const where: Prisma.InventorySessionWhereInput = { ...scope };
    if (query.status) {
      where.status = query.status;
    }
    if (query.scopeType) {
      where.scopeType = query.scopeType;
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
        { warehouse: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.inventorySession.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }],
        include: {
          warehouse: { select: placeSelect },
          store: { select: placeSelect },
          items: {
            select: { physicalQty: true, variance: true, theoreticalQty: true },
          },
        },
      }),
      this.prisma.inventorySession.count({ where }),
    ]);

    return {
      items: rows.map(toListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(actor: AuthUser, id: string): Promise<InventoryDetail> {
    const detail = await this.loadDetail(id);
    if (!detail) {
      throw notFound();
    }
    await this.assertCanViewSession(actor, detail);
    return detail;
  }

  async create(actor: AuthUser, dto: CreateInventoryDto, meta: RequestMeta): Promise<InventoryDetail> {
    await this.assertCanConduct(actor, dto.scopeType, dto.warehouseId ?? null, dto.storeId ?? null);
    await this.assertLocationActive(dto.scopeType, dto.warehouseId, dto.storeId);
    await this.assertNoOpenSession(dto.scopeType, dto.warehouseId, dto.storeId);

    const detail = await this.prisma.$transaction(async (tx) => {
      const reference = await this.sequences.nextReference(DocumentSequenceCode.INVENTORY, tx);
      const session = await tx.inventorySession.create({
        data: {
          reference,
          scopeType: dto.scopeType,
          warehouseId: dto.scopeType === ScopeType.WAREHOUSE ? dto.warehouseId! : null,
          storeId: dto.scopeType === ScopeType.STORE ? dto.storeId! : null,
          status: InventoryStatus.DRAFT,
          startedById: actor.id,
          note: trimNote(dto.note),
        },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INVENTORY_AUDIT.CREATED,
          entityType: INVENTORY_AUDIT_ENTITY.SESSION,
          entityId: session.id,
          storeId: session.storeId,
          newValue: { reference, scopeType: dto.scopeType },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      return session.id;
    });

    return this.findOne(actor, detail);
  }

  async update(actor: AuthUser, id: string, dto: UpdateInventoryDto, meta: RequestMeta): Promise<InventoryDetail> {
    const session = await this.requireSession(id);
    await this.assertCanViewSession(actor, await this.mustDetail(session));
    if (session.status !== InventoryStatus.DRAFT) {
      throw invalidStatus("Seule une session en brouillon peut être modifiée.");
    }

    await this.prisma.inventorySession.update({
      where: { id },
      data: { note: dto.note === undefined ? undefined : trimNote(dto.note) },
    });
    await this.audit.write({
      actorId: actor.id,
      action: INVENTORY_AUDIT.UPDATED,
      entityType: INVENTORY_AUDIT_ENTITY.SESSION,
      entityId: id,
      storeId: session.storeId,
      newValue: { note: dto.note },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.findOne(actor, id);
  }

  async start(actor: AuthUser, id: string, meta: RequestMeta): Promise<InventoryDetail> {
    const session = await this.requireSession(id);
    const detail = await this.mustDetail(session);
    await this.assertCanConduct(actor, session.scopeType, session.warehouseId, session.storeId);
    await this.assertCanViewSession(actor, detail);
    if (session.status !== InventoryStatus.DRAFT) {
      throw invalidStatus("Le décompte ne peut être ouvert que depuis un brouillon.");
    }

    await this.prisma.$transaction(async (tx) => {
      const lineCount = await this.snapshotSessionItems(tx, session);
      if (lineCount === 0) {
        throw new ApiException(
          INVENTORY_ERROR.EMPTY_ITEMS,
          "Aucun produit à inventorier à ce lieu — saisissez du stock ou autorisez des produits boutique.",
          HttpStatus.CONFLICT,
        );
      }
      await tx.inventorySession.update({
        where: { id },
        data: {
          status: InventoryStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INVENTORY_AUDIT.STARTED,
          entityType: INVENTORY_AUDIT_ENTITY.SESSION,
          entityId: id,
          storeId: session.storeId,
          newValue: { status: InventoryStatus.IN_PROGRESS, lineCount },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async patchItems(actor: AuthUser, id: string, dto: PatchInventoryItemsDto, meta: RequestMeta): Promise<InventoryDetail> {
    const session = await this.requireSession(id);
    await this.assertCanConduct(actor, session.scopeType, session.warehouseId, session.storeId);
    if (
      session.status !== InventoryStatus.IN_PROGRESS &&
      session.status !== InventoryStatus.DRAFT &&
      session.status !== InventoryStatus.PENDING_VALIDATION
    ) {
      throw invalidStatus("La saisie physique est réservée avant validation définitive.");
    }

    if (session.status === InventoryStatus.DRAFT) {
      await this.prisma.$transaction(async (tx) => {
        await this.snapshotSessionItems(tx, session);
        await tx.inventorySession.update({
          where: { id },
          data: { status: InventoryStatus.IN_PROGRESS, startedAt: new Date() },
        });
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findMany({
        where: { inventorySessionId: id },
        select: { id: true, productId: true, theoreticalQty: true },
      });
      const byProduct = new Map(existing.map((row) => [row.productId, row]));

      for (const patch of dto.items) {
        let line = byProduct.get(patch.productId);
        if (!line) {
          const snapshot = await this.snapshotProductLine(tx, session, patch.productId);
          const created = await tx.inventoryItem.create({
            data: {
              inventorySessionId: id,
              productId: patch.productId,
              ...snapshot,
              physicalQty: patch.physicalQty,
              variance: patch.physicalQty - snapshot.theoreticalQty,
              justification: trimJustification(patch.justification),
            },
            select: { id: true, productId: true, theoreticalQty: true },
          });
          byProduct.set(patch.productId, created);
          line = created;
        } else {
          const variance = patch.physicalQty - line.theoreticalQty;
          await tx.inventoryItem.update({
            where: { id: line.id },
            data: {
              physicalQty: patch.physicalQty,
              variance,
              justification: trimJustification(patch.justification),
            },
          });
        }
      }

      await this.audit.write(
        {
          actorId: actor.id,
          action: INVENTORY_AUDIT.ITEMS_UPDATED,
          entityType: INVENTORY_AUDIT_ENTITY.SESSION,
          entityId: id,
          storeId: session.storeId,
          newValue: { linePatches: dto.items.length },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async submit(actor: AuthUser, id: string, meta: RequestMeta): Promise<InventoryDetail> {
    const session = await this.requireSession(id);
    await this.assertCanConduct(actor, session.scopeType, session.warehouseId, session.storeId);
    if (session.status !== InventoryStatus.IN_PROGRESS) {
      throw invalidStatus("Seul un décompte en cours peut être soumis à validation.");
    }

    const items = await this.prisma.inventoryItem.findMany({ where: { inventorySessionId: id } });
    if (items.length === 0) {
      throw new ApiException(INVENTORY_ERROR.EMPTY_ITEMS, "Session vide.", HttpStatus.CONFLICT);
    }
    const missingPhysical = items.some((line) => line.physicalQty === null);
    if (missingPhysical) {
      throw new ApiException(
        INVENTORY_ERROR.PHYSICAL_REQUIRED,
        "Chaque ligne doit avoir une quantité physique avant soumission.",
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.inventorySession.update({
        where: { id },
        data: { status: InventoryStatus.PENDING_VALIDATION },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INVENTORY_AUDIT.SUBMITTED,
          entityType: INVENTORY_AUDIT_ENTITY.SESSION,
          entityId: id,
          storeId: session.storeId,
          newValue: { status: InventoryStatus.PENDING_VALIDATION },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async validate(actor: AuthUser, id: string, meta: RequestMeta): Promise<InventoryDetail> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "inventory.validate")) {
      throw forbiddenScope();
    }

    const session = await this.requireSession(id);
    if (session.status !== InventoryStatus.PENDING_VALIDATION) {
      throw invalidStatus("Seule une session en attente de validation centrale peut être validée.");
    }

    const requiresJustification = await this.loadJustificationRequired();

    await this.prisma.$transaction(async (tx) => {
      const items = await tx.inventoryItem.findMany({
        where: { inventorySessionId: id },
        include: { product: { select: { reference: true, name: true } } },
      });

      let varianceLines = 0;
      let varianceUnits = 0;

      for (const line of items) {
        if (line.physicalQty === null) {
          throw new ApiException(
            INVENTORY_ERROR.PHYSICAL_REQUIRED,
            "Quantité physique manquante sur une ligne.",
            HttpStatus.CONFLICT,
          );
        }

        const locked = await this.stockMovements.lockLevelForUpdate(
          tx,
          line.productId,
          session.warehouseId,
          session.storeId,
        );
        const theoreticalQty = locked?.quantityOnHand ?? 0;
        const variance = line.physicalQty - theoreticalQty;

        if (variance !== 0) {
          varianceLines += 1;
          varianceUnits += Math.abs(variance);
          if (requiresJustification && !line.justification?.trim()) {
            throw new ApiException(
              INVENTORY_ERROR.JUSTIFICATION_REQUIRED,
              `Motif obligatoire pour l'écart sur ${line.product.reference}.`,
              HttpStatus.UNPROCESSABLE_ENTITY,
              { productId: line.productId, variance },
            );
          }
        }

        await tx.inventoryItem.update({
          where: { id: line.id },
          data: { theoreticalQty, variance },
        });

        if (variance !== 0) {
          const direction = variance > 0 ? MovementDirection.IN : MovementDirection.OUT;
          const quantity = Math.abs(variance);
          const note =
            line.justification?.trim() ||
            `Inventaire ${session.reference} — écart ${variance > 0 ? "+" : ""}${variance}`;
          await this.stockMovements.recordInventoryAdjustment(tx, {
            productId: line.productId,
            warehouseId: session.warehouseId,
            storeId: session.storeId,
            direction,
            quantity,
            inventorySessionId: id,
            inventoryItemId: line.id,
            createdById: actor.id,
            note,
          });
        }
      }

      const closedAt = new Date();
      await tx.inventorySession.update({
        where: { id },
        data: {
          status: InventoryStatus.VALIDATED,
          validatedById: actor.id,
          validatedAt: closedAt,
          closedAt,
        },
      });

      const locationLabel = await resolveLocationLabel(tx, session.warehouseId, session.storeId);
      await this.notifications.notifyVariance(tx, {
        sessionId: id,
        reference: session.reference,
        locationLabel,
        storeId: session.storeId,
        varianceLines,
        varianceUnits,
      });

      await this.audit.write(
        {
          actorId: actor.id,
          action: INVENTORY_AUDIT.VALIDATED,
          entityType: INVENTORY_AUDIT_ENTITY.SESSION,
          entityId: id,
          storeId: session.storeId,
          newValue: { status: InventoryStatus.VALIDATED, varianceLines, varianceUnits },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async cancel(actor: AuthUser, id: string, dto: CancelInventoryDto, meta: RequestMeta): Promise<InventoryDetail> {
    const session = await this.requireSession(id);
    await this.assertCanViewSession(actor, await this.mustDetail(session));

    if (session.status === InventoryStatus.VALIDATED || session.status === InventoryStatus.CANCELLED) {
      throw invalidStatus("Cette session ne peut plus être annulée.");
    }

    const context = await this.access.loadContext(actor.id);
    const isValidator = this.access.hasPermission(context, "inventory.validate");
    if (session.status === InventoryStatus.PENDING_VALIDATION && !isValidator && !context.isGlobalScope) {
      throw forbiddenScope();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.inventorySession.update({
        where: { id },
        data: {
          status: InventoryStatus.CANCELLED,
          closedAt: new Date(),
          note: appendCancelNote(session.note, dto.reason),
        },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INVENTORY_AUDIT.CANCELLED,
          entityType: INVENTORY_AUDIT_ENTITY.SESSION,
          entityId: id,
          storeId: session.storeId,
          newValue: { status: InventoryStatus.CANCELLED, reason: dto.reason },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  private async snapshotSessionItems(tx: PrismaTx, session: InventorySession): Promise<number> {
    await tx.inventoryItem.deleteMany({ where: { inventorySessionId: session.id } });
    const productIds = await this.resolveProductIdsForLocation(tx, session);
    if (productIds.length === 0) {
      return 0;
    }
    const data: Prisma.InventoryItemCreateManyInput[] = [];
    for (const productId of productIds) {
      const snapshot = await this.snapshotProductLine(tx, session, productId);
      data.push({
        inventorySessionId: session.id,
        productId,
        ...snapshot,
        physicalQty: null,
        variance: null,
        justification: null,
      });
    }
    await tx.inventoryItem.createMany({ data });
    return data.length;
  }

  private async snapshotProductLine(tx: PrismaTx, session: InventorySession, productId: string) {
    if (session.scopeType === ScopeType.STORE && session.storeId) {
      await this.assertStoreProductAuthorized(tx, session.storeId, productId);
    }
    const level = await tx.stockLevel.findFirst({
      where: {
        productId,
        warehouseId: session.warehouseId,
        storeId: session.storeId,
      },
      select: { quantityOnHand: true },
    });
    const quantityOnHand = level?.quantityOnHand ?? 0;
    const movements = await tx.stockMovement.findMany({
      where: {
        productId,
        warehouseId: session.warehouseId,
        storeId: session.storeId,
      },
      select: { movementType: true, direction: true, quantity: true },
    });
    const buckets = aggregateMovementBreakdown(movements);
    return buildFrozenSnapshot(quantityOnHand, buckets);
  }

  private async resolveProductIdsForLocation(tx: PrismaTx, session: InventorySession): Promise<string[]> {
    if (session.scopeType === ScopeType.WAREHOUSE && session.warehouseId) {
      const levels = await tx.stockLevel.findMany({
        where: { warehouseId: session.warehouseId, storeId: null, quantityOnHand: { gt: 0 } },
        select: { productId: true },
      });
      return levels.map((row) => row.productId);
    }
    if (session.scopeType === ScopeType.STORE && session.storeId) {
      const [levels, authorized] = await Promise.all([
        tx.stockLevel.findMany({
          where: { storeId: session.storeId, warehouseId: null },
          select: { productId: true, quantityOnHand: true },
        }),
        tx.productStore.findMany({
          where: { storeId: session.storeId, isAuthorized: true },
          select: { productId: true },
        }),
      ]);
      const authorizedSet = new Set(authorized.map((row) => row.productId));
      const ids = new Set<string>();
      for (const level of levels) {
        if (authorizedSet.has(level.productId) && (level.quantityOnHand > 0 || level.quantityOnHand === 0)) {
          ids.add(level.productId);
        }
      }
      for (const row of authorized) {
        if (!ids.has(row.productId)) {
          const level = levels.find((l) => l.productId === row.productId);
          if (!level) {
            ids.add(row.productId);
          }
        }
      }
      return [...ids];
    }
    return [];
  }

  private async assertStoreProductAuthorized(tx: PrismaTx, storeId: string, productId: string): Promise<void> {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, status: true } });
    if (!product || product.status === ProductStatus.ARCHIVED) {
      throw new ApiException(INVENTORY_ERROR.PRODUCT_NOT_FOUND, "Produit introuvable.", HttpStatus.BAD_REQUEST);
    }
    const link = await tx.productStore.findFirst({
      where: { storeId, productId, isAuthorized: true },
      select: { id: true },
    });
    if (!link) {
      throw new ApiException(
        INVENTORY_ERROR.PRODUCT_NOT_AUTHORIZED,
        "Ce produit n'est pas autorisé dans cette boutique.",
        HttpStatus.CONFLICT,
      );
    }
  }

  private async assertNoOpenSession(scopeType: ScopeType, warehouseId?: string, storeId?: string): Promise<void> {
    const where: Prisma.InventorySessionWhereInput = {
      status: { in: OPEN_INVENTORY_STATUSES },
      scopeType,
    };
    if (scopeType === ScopeType.WAREHOUSE) {
      where.warehouseId = warehouseId;
    } else {
      where.storeId = storeId;
    }
    const open = await this.prisma.inventorySession.findFirst({ where, select: { id: true, reference: true } });
    if (open) {
      throw new ApiException(
        INVENTORY_ERROR.OPEN_SESSION_EXISTS,
        `Une session est déjà ouverte (${open.reference}).`,
        HttpStatus.CONFLICT,
        { sessionId: open.id },
      );
    }
  }

  private async assertLocationActive(scopeType: ScopeType, warehouseId?: string, storeId?: string): Promise<void> {
    if (scopeType === ScopeType.WAREHOUSE) {
      const row = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
      if (!row || row.status !== ReferentialStatus.ACTIVE) {
        throw new ApiException(INVENTORY_ERROR.WAREHOUSE_INACTIVE, "Entrepôt invalide.", HttpStatus.BAD_REQUEST);
      }
      return;
    }
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== ReferentialStatus.ACTIVE) {
      throw new ApiException(INVENTORY_ERROR.STORE_INACTIVE, "Boutique invalide.", HttpStatus.BAD_REQUEST);
    }
  }

  private async assertCanConduct(
    actor: AuthUser,
    scopeType: ScopeType,
    warehouseId: string | null,
    storeId: string | null,
  ): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "inventory.conduct")) {
      throw forbiddenScope();
    }
    if (context.isGlobalScope) {
      return;
    }
    if (scopeType === ScopeType.WAREHOUSE) {
      if (actor.role.code !== "WAREHOUSE_MANAGER") {
        throw forbiddenScope();
      }
      return;
    }
    if (storeId) {
      this.assertStoreAssigned(actor, storeId);
    }
  }

  private async assertCanViewSession(actor: AuthUser, detail: InventoryDetail): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope || this.access.hasPermission(context, "inventory.validate")) {
      return;
    }
    if (detail.scopeType === ScopeType.WAREHOUSE) {
      if (actor.role.code === "WAREHOUSE_MANAGER") {
        return;
      }
      throw forbiddenScope();
    }
    if (detail.store?.id) {
      this.assertStoreAssigned(actor, detail.store.id);
    }
  }

  private async buildScope(
    actor: AuthUser,
    query: Pick<ListInventoriesQueryDto, "storeId" | "warehouseId">,
  ): Promise<Prisma.InventorySessionWhereInput> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope || this.access.hasPermission(context, "inventory.validate")) {
      const filter: Prisma.InventorySessionWhereInput = {};
      if (query.storeId) {
        filter.storeId = query.storeId;
      }
      if (query.warehouseId) {
        filter.warehouseId = query.warehouseId;
      }
      return filter;
    }
    if (actor.role.code === "WAREHOUSE_MANAGER") {
      return { scopeType: ScopeType.WAREHOUSE };
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

  private assertStoreAssigned(actor: AuthUser, storeId: string): void {
    if (!actor.stores.some((store) => store.id === storeId)) {
      throw forbiddenScope();
    }
  }

  private async requireSession(id: string): Promise<InventorySession> {
    const session = await this.prisma.inventorySession.findUnique({ where: { id } });
    if (!session) {
      throw notFound();
    }
    return session;
  }

  private async mustDetail(session: InventorySession): Promise<InventoryDetail> {
    const detail = await this.loadDetail(session.id);
    if (!detail) {
      throw notFound();
    }
    return detail;
  }

  private async loadDetail(id: string): Promise<InventoryDetail | null> {
    const row = await this.prisma.inventorySession.findUnique({
      where: { id },
      include: {
        warehouse: { select: placeSelect },
        store: { select: placeSelect },
        startedBy: { select: personSelect },
        validatedBy: { select: personSelect },
        items: {
          orderBy: [{ product: { reference: "asc" } }],
          include: { product: { select: { id: true, reference: true, name: true } } },
        },
      },
    });
    if (!row) {
      return null;
    }
    return toDetail(row);
  }

  private async loadJustificationRequired(): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: SETTING_INVENTORY_REQUIRES_JUSTIFICATION } });
    if (!row) {
      return true;
    }
    return row.value === true;
  }
}

function toListItem(
  row: InventorySession & {
    warehouse: { id: string; code: string; name: string } | null;
    store: { id: string; code: string; name: string } | null;
    items: { physicalQty: number | null; variance: number | null; theoreticalQty: number }[];
  },
): InventoryListItem {
  const countedLines = row.items.filter((line) => line.physicalQty !== null).length;
  const varianceLines = row.items.filter((line) => line.variance !== null && line.variance !== 0).length;
  const totalVarianceUnits = row.items.reduce(
    (sum, line) => sum + (line.variance === null ? 0 : Math.abs(line.variance)),
    0,
  );
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    scopeType: row.scopeType,
    warehouse: row.warehouse,
    store: row.store,
    lineCount: row.items.length,
    countedLines,
    varianceLines,
    totalVarianceUnits,
    startedAt: row.startedAt?.toISOString() ?? null,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

function toDetail(
  row: InventorySession & {
    warehouse: { id: string; code: string; name: string } | null;
    store: { id: string; code: string; name: string } | null;
    startedBy: { id: string; firstName: string; lastName: string };
    validatedBy: { id: string; firstName: string; lastName: string } | null;
    items: (InventoryItem & { product: { id: string; reference: string; name: string } })[];
  },
): InventoryDetail {
  const list = toListItem(row);
  return {
    ...list,
    note: row.note,
    startedBy: row.startedBy,
    validatedBy: row.validatedBy,
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((line) => ({
      id: line.id,
      productId: line.productId,
      productReference: line.product.reference,
      productName: line.product.name,
      theoreticalQty: line.theoreticalQty,
      physicalQty: line.physicalQty,
      variance: line.variance,
      justification: line.justification,
      initialQty: line.initialQty,
      receiptsQty: line.receiptsQty,
      transfersInQty: line.transfersInQty,
      transfersOutQty: line.transfersOutQty,
      salesQty: line.salesQty,
      internalIssuesQty: line.internalIssuesQty,
      adjustmentsQty: line.adjustmentsQty,
    })),
  };
}

function notFound(): ApiException {
  return new ApiException(INVENTORY_ERROR.NOT_FOUND, "Session d'inventaire introuvable.", HttpStatus.NOT_FOUND);
}

function invalidStatus(message: string): ApiException {
  return new ApiException(INVENTORY_ERROR.INVALID_STATUS, message, HttpStatus.CONFLICT);
}

function forbiddenScope(): ApiException {
  return new ApiException(INVENTORY_ERROR.FORBIDDEN_SCOPE, "Hors de votre périmètre inventaire.", HttpStatus.FORBIDDEN);
}

function trimNote(note: string | null | undefined): string | null {
  const value = note?.trim();
  return value ? value : null;
}

function trimJustification(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function appendCancelNote(note: string | null, reason?: string): string | null {
  const fragment = reason?.trim();
  if (!fragment) {
    return note;
  }
  const prefix = note?.trim() ? `${note.trim()}\n` : "";
  return `${prefix}[Annulation] ${fragment}`;
}

async function resolveLocationLabel(
  tx: PrismaTx,
  warehouseId: string | null,
  storeId: string | null,
): Promise<string> {
  if (warehouseId) {
    const wh = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { code: true, name: true } });
    return wh ? `Entrepôt ${wh.code}` : "Entrepôt";
  }
  if (storeId) {
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { code: true, name: true } });
    return store ? `Boutique ${store.code}` : "Boutique";
  }
  return "Lieu";
}