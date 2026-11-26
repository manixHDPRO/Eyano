import { HttpStatus, Injectable } from "@nestjs/common";
import { MovementDirection, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { ListStockLevelsQueryDto } from "./dto/list-stock-levels.query.dto";
import { ListStockMovementsQueryDto } from "./dto/list-stock-movements.query.dto";
import { ManualAdjustmentDto } from "./dto/manual-adjustment.dto";
import { ReconcileStockQueryDto } from "./dto/reconcile-stock.query.dto";
import {
  SETTING_ALLOW_MANUAL_ADJUSTMENT,
  SETTING_STOCK_ALERT_DEFAULT,
  STOCK_AUDIT,
  STOCK_AUDIT_ENTITY,
  STOCK_MOVEMENTS_ERROR,
  STOCK_QUERY_ERROR,
  type StockAlertStatus,
} from "./stock-movements.constants";
import { StockMovementsService } from "./stock-movements.service";

@Injectable()
export class StockQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly stockMovements: StockMovementsService,
    private readonly audit: AuditLogsService,
  ) {}

  async summary(actor: AuthUser) {
    const scope = await this.buildLevelScope(actor, {});
    const defaultThreshold = await readDefaultThreshold(this.prisma);
    const rows = await this.prisma.stockLevel.findMany({
      where: scope,
      select: {
        quantityOnHand: true,
        product: { select: { alertThreshold: true } },
      },
    });

    let low = 0;
    let stockout = 0;
    let ok = 0;
    for (const row of rows) {
      const effective = row.product.alertThreshold ?? defaultThreshold;
      const status = computeAlertStatus(row.quantityOnHand, effective);
      if (status === "STOCKOUT") stockout += 1;
      else if (status === "LOW") low += 1;
      else ok += 1;
    }

    return {
      totalLevels: rows.length,
      ok,
      low,
      stockout,
    };
  }

  async listLevels(actor: AuthUser, query: ListStockLevelsQueryDto) {
    const scope = await this.buildLevelScope(actor, query);
    const defaultThreshold = await readDefaultThreshold(this.prisma);
    const where: Prisma.StockLevelWhereInput = { ...scope };

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
      where.storeId = null;
    }
    if (query.storeId) {
      where.storeId = query.storeId;
      where.warehouseId = null;
    }
    if (query.locationKind === "WAREHOUSE") {
      where.warehouseId = { not: null };
      where.storeId = null;
    }
    if (query.locationKind === "STORE") {
      where.storeId = { not: null };
      where.warehouseId = null;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { product: { reference: { contains: search, mode: "insensitive" } } },
        { product: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (query.alertStatus === "STOCKOUT") {
      where.quantityOnHand = { lte: 0 };
    }

    const include = {
      product: { select: { id: true, reference: true, name: true, alertThreshold: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      store: { select: { id: true, code: true, name: true } },
    } as const;

    const skip = (query.page - 1) * query.pageSize;

    if (query.alertStatus === "LOW" || query.alertStatus === "OK") {
      const rows = await this.prisma.stockLevel.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        include,
      });
      const allItems = rows
        .map((row) => toStockLevelItem(row, defaultThreshold))
        .filter((item) => item.alertStatus === query.alertStatus);
      const total = allItems.length;
      const items = allItems.slice(skip, skip + query.pageSize);
      return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.stockLevel.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ updatedAt: "desc" }],
        include,
      }),
      this.prisma.stockLevel.count({ where }),
    ]);

    const items = rows.map((row) => toStockLevelItem(row, defaultThreshold));

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async listMovements(actor: AuthUser, query: ListStockMovementsQueryDto) {
    const scope = await this.buildMovementScope(actor, query);
    const where: Prisma.StockMovementWhereInput = { ...scope };

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.movementType) {
      where.movementType = query.movementType;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
      where.storeId = null;
    }
    if (query.storeId) {
      where.storeId = query.storeId;
      where.warehouseId = null;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { product: { reference: { contains: search, mode: "insensitive" } } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { note: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ occurredAt: "desc" }],
        include: {
          product: { select: { id: true, reference: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          store: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        product: row.product,
        warehouse: row.warehouse,
        store: row.store,
        movementType: row.movementType,
        direction: row.direction,
        quantity: row.quantity,
        unitCost: row.unitCost ? String(row.unitCost) : null,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        note: row.note,
        occurredAt: row.occurredAt.toISOString(),
        createdBy: row.createdBy,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async manualAdjustment(actor: AuthUser, dto: ManualAdjustmentDto, meta: RequestMeta) {
    if (!(await isManualAdjustmentEnabled(this.prisma))) {
      throw new ApiException(
        STOCK_MOVEMENTS_ERROR.MANUAL_ADJUSTMENT_DISABLED,
        "Les ajustements manuels sont désactivés dans les paramètres.",
        HttpStatus.CONFLICT,
      );
    }

    const adjustmentId = randomUUID();
    const result = await this.prisma.$transaction(async (tx) => {
      return this.stockMovements.recordManualAdjustment(tx, {
        productId: dto.productId,
        warehouseId: dto.warehouseId ?? null,
        storeId: dto.storeId ?? null,
        direction: dto.direction,
        quantity: dto.quantity,
        adjustmentId,
        createdById: actor.id,
        note: dto.note.trim(),
      });
    });

    await this.audit.write({
      actorId: actor.id,
      action: "stock.manual_adjustment",
      entityType: "StockMovement",
      entityId: result.movementId,
      storeId: dto.storeId ?? null,
      newValue: {
        productId: dto.productId,
        direction: dto.direction,
        quantity: dto.quantity,
        quantityOnHand: result.quantityOnHand,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      movementId: result.movementId,
      quantityOnHand: result.quantityOnHand,
      previousOnHand: result.previousOnHand,
    };
  }

  async reconcile(actor: AuthUser, query: ReconcileStockQueryDto, meta: RequestMeta) {
    if (actor.role.code !== "SUPER_ADMIN") {
      throw new ApiException(
        STOCK_QUERY_ERROR.RECONCILE_FORBIDDEN,
        "Seul un super administrateur peut lancer la réconciliation des stocks.",
        HttpStatus.FORBIDDEN,
      );
    }

    const where: Prisma.StockLevelWhereInput = {};
    if (query.productId) where.productId = query.productId;
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
      where.storeId = null;
    }
    if (query.storeId) {
      where.storeId = query.storeId;
      where.warehouseId = null;
    }

    const levels = await this.prisma.stockLevel.findMany({
      where,
      select: {
        id: true,
        productId: true,
        warehouseId: true,
        storeId: true,
        quantityOnHand: true,
      },
    });

    const discrepancies: {
      stockLevelId: string;
      productId: string;
      warehouseId: string | null;
      storeId: string | null;
      quantityOnHand: number;
      movementSum: number;
      delta: number;
    }[] = [];

    for (const level of levels) {
      const movementSum = await sumMovementsForLevel(this.prisma, level);
      if (movementSum !== level.quantityOnHand) {
        discrepancies.push({
          stockLevelId: level.id,
          productId: level.productId,
          warehouseId: level.warehouseId,
          storeId: level.storeId,
          quantityOnHand: level.quantityOnHand,
          movementSum,
          delta: level.quantityOnHand - movementSum,
        });
      }
    }

    await this.audit.write({
      actorId: actor.id,
      action: STOCK_AUDIT.RECONCILE,
      entityType: STOCK_AUDIT_ENTITY.STOCK_LEVEL,
      entityId: randomUUID(),
      newValue: {
        checked: levels.length,
        discrepancyCount: discrepancies.length,
        discrepancies,
        filters: query,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      checked: levels.length,
      discrepancyCount: discrepancies.length,
      discrepancies,
    };
  }

  private async buildLevelScope(
    actor: AuthUser,
    query: Pick<ListStockLevelsQueryDto, "storeId" | "warehouseId">,
  ): Promise<Prisma.StockLevelWhereInput> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope) {
      return {};
    }

    if (actor.role.code === "WAREHOUSE_MANAGER") {
      return { warehouseId: { not: null }, storeId: null };
    }

    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    if (query.storeId) {
      assertStoreInScope(actor, query.storeId);
      return { storeId: query.storeId, warehouseId: null };
    }
    return { storeId: { in: storeIds }, warehouseId: null };
  }

  private async buildMovementScope(
    actor: AuthUser,
    query: Pick<ListStockMovementsQueryDto, "storeId" | "warehouseId">,
  ): Promise<Prisma.StockMovementWhereInput> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope) {
      return {};
    }

    if (actor.role.code === "WAREHOUSE_MANAGER") {
      return { warehouseId: { not: null }, storeId: null };
    }

    const storeIds = actor.stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { productId: { in: [] } };
    }
    if (query.storeId) {
      assertStoreInScope(actor, query.storeId);
      return { storeId: query.storeId, warehouseId: null };
    }
    return { storeId: { in: storeIds }, warehouseId: null };
  }
}

type StockLevelRow = Prisma.StockLevelGetPayload<{
  include: {
    product: { select: { id: true; reference: true; name: true; alertThreshold: true } };
    warehouse: { select: { id: true; code: true; name: true } };
    store: { select: { id: true; code: true; name: true } };
  };
}>;

function toStockLevelItem(row: StockLevelRow, defaultThreshold: number) {
  const effectiveThreshold = row.product.alertThreshold ?? defaultThreshold;
  const alertStatus = computeAlertStatus(row.quantityOnHand, effectiveThreshold);
  return {
    id: row.id,
    product: row.product,
    warehouse: row.warehouse,
    store: row.store,
    quantityOnHand: row.quantityOnHand,
    quantityReserved: row.quantityReserved,
    quantityAvailable: row.quantityOnHand - row.quantityReserved,
    effectiveThreshold,
    alertStatus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function computeAlertStatus(quantityOnHand: number, threshold: number): StockAlertStatus {
  if (quantityOnHand <= 0) {
    return "STOCKOUT";
  }
  if (quantityOnHand <= threshold) {
    return "LOW";
  }
  return "OK";
}

async function readDefaultThreshold(prisma: PrismaService): Promise<number> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_STOCK_ALERT_DEFAULT } });
  return typeof setting?.value === "number" ? setting.value : 100;
}

async function sumMovementsForLevel(
  prisma: PrismaService,
  level: { productId: string; warehouseId: string | null; storeId: string | null },
): Promise<number> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      productId: level.productId,
      warehouseId: level.warehouseId,
      storeId: level.storeId,
    },
    select: { direction: true, quantity: true },
  });
  return movements.reduce((sum, row) => {
    return sum + (row.direction === MovementDirection.IN ? row.quantity : -row.quantity);
  }, 0);
}

function assertStoreInScope(actor: AuthUser, storeId: string): void {
  if (!actor.stores.some((store) => store.id === storeId)) {
    throw new ApiException(
      STOCK_QUERY_ERROR.FORBIDDEN_SCOPE,
      "Cette boutique ne fait pas partie de votre périmètre.",
      HttpStatus.FORBIDDEN,
      { storeId },
    );
  }
}

async function isManualAdjustmentEnabled(prisma: PrismaService): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_ALLOW_MANUAL_ADJUSTMENT } });
  return row?.value === true;
}