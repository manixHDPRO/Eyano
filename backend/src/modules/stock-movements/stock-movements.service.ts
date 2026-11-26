import { HttpStatus, Injectable } from "@nestjs/common";
import {
  MovementDirection,
  MovementType,
  Prisma,
  type StockLevel,
} from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { STOCK_MOVEMENTS_ERROR, STOCK_SOURCE_TYPE } from "./stock-movements.constants";
import { StockNotificationsService } from "./stock-notifications.service";

export type RecordGoodsReceiptInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: Prisma.Decimal;
  goodsReceiptId: string;
  createdById: string;
  note?: string | null;
};

export type RecordManualAdjustmentInput = {
  productId: string;
  warehouseId?: string | null;
  storeId?: string | null;
  direction: MovementDirection;
  quantity: number;
  adjustmentId: string;
  createdById: string;
  note: string;
};

export type RecordInventoryAdjustmentInput = {
  productId: string;
  warehouseId?: string | null;
  storeId?: string | null;
  direction: MovementDirection;
  quantity: number;
  inventorySessionId: string;
  inventoryItemId: string;
  createdById: string;
  note: string;
};

export type ReserveWarehouseInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
};

export type RecordTransferOutInput = {
  productId: string;
  warehouseId: string;
  quantityShipped: number;
  quantityReservedRelease: number;
  transferId: string;
  createdById: string;
  unitCost: Prisma.Decimal;
  note?: string | null;
};

export type RecordTransferInInput = {
  productId: string;
  storeId: string;
  quantity: number;
  transferId: string;
  createdById: string;
  unitCost: Prisma.Decimal;
  note?: string | null;
};

export type RecordInternalIssueInput = {
  productId: string;
  warehouseId?: string | null;
  storeId?: string | null;
  quantity: number;
  internalIssueId: string;
  createdById: string;
  note?: string | null;
};

export type RecordSaleInput = {
  productId: string;
  storeId: string;
  quantity: number;
  saleId: string;
  createdById: string;
  note?: string | null;
};

export type RecordSaleReversalInput = {
  productId: string;
  storeId: string;
  quantity: number;
  saleId: string;
  createdById: string;
  note?: string | null;
};

export type RecordMovementInput = {
  productId: string;
  warehouseId: string | null;
  storeId: string | null;
  movementType: MovementType;
  direction: MovementDirection;
  quantity: number;
  sourceType: string;
  sourceId: string;
  createdById: string;
  unitCost?: Prisma.Decimal | null;
  note?: string | null;
};

type PrismaTx = Prisma.TransactionClient;

export type MovementWriteResult = {
  movementId: string;
  quantityOnHand: number;
  previousOnHand: number;
};

export type GoodsReceiptStockResult = {
  movementId: string;
  quantityOnHand: number;
};

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockAlerts: StockNotificationsService,
  ) {}

  async recordGoodsReceiptIn(tx: PrismaTx, input: RecordGoodsReceiptInput): Promise<GoodsReceiptStockResult> {
    const result = await this.recordMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      storeId: null,
      movementType: MovementType.GOODS_RECEIPT,
      direction: MovementDirection.IN,
      quantity: input.quantity,
      sourceType: STOCK_SOURCE_TYPE.GOODS_RECEIPT,
      sourceId: input.goodsReceiptId,
      createdById: input.createdById,
      unitCost: input.unitCost,
      note: input.note ?? null,
    });
    return { movementId: result.movementId, quantityOnHand: result.quantityOnHand };
  }

  async recordManualAdjustment(tx: PrismaTx, input: RecordManualAdjustmentInput): Promise<MovementWriteResult> {
    assertExclusiveLocation(input.warehouseId, input.storeId);
    return this.recordMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId ?? null,
      storeId: input.storeId ?? null,
      movementType: MovementType.MANUAL_ADJUSTMENT,
      direction: input.direction,
      quantity: input.quantity,
      sourceType: STOCK_SOURCE_TYPE.MANUAL_ADJUSTMENT,
      sourceId: input.adjustmentId,
      createdById: input.createdById,
      note: input.note,
    });
  }

  async recordInventoryAdjustment(tx: PrismaTx, input: RecordInventoryAdjustmentInput): Promise<MovementWriteResult> {
    assertExclusiveLocation(input.warehouseId, input.storeId);
    return this.recordMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId ?? null,
      storeId: input.storeId ?? null,
      movementType: MovementType.INVENTORY_ADJUSTMENT,
      direction: input.direction,
      quantity: input.quantity,
      sourceType: STOCK_SOURCE_TYPE.INVENTORY,
      sourceId: input.inventoryItemId,
      createdById: input.createdById,
      note: input.note,
    });
  }

  /** Réserve du disponible entrepôt : le physique ne bouge pas. */
  async reserveWarehouseQuantity(tx: PrismaTx, input: ReserveWarehouseInput): Promise<StockLevel> {
    assertPositiveInteger(input.quantity);
    const locked = await lockStockLevel(tx, input.productId, input.warehouseId, null);
    if (!locked) {
      throw insufficientStock();
    }
    const available = locked.quantityOnHand - locked.quantityReserved;
    if (available < input.quantity) {
      throw insufficientStock();
    }
    return tx.stockLevel.update({
      where: { id: locked.id },
      data: { quantityReserved: locked.quantityReserved + input.quantity },
    });
  }

  /** Libère une réservation entrepôt (annulation avant expédition). */
  async releaseWarehouseReservation(tx: PrismaTx, input: ReserveWarehouseInput): Promise<StockLevel> {
    assertPositiveInteger(input.quantity);
    const locked = await lockStockLevel(tx, input.productId, input.warehouseId, null);
    if (!locked || locked.quantityReserved < input.quantity) {
      throw new ApiException(
        STOCK_MOVEMENTS_ERROR.INSUFFICIENT_STOCK,
        "Réservation entrepôt incohérente : impossible de libérer cette quantité.",
        HttpStatus.CONFLICT,
      );
    }
    return tx.stockLevel.update({
      where: { id: locked.id },
      data: { quantityReserved: locked.quantityReserved - input.quantity },
    });
  }

  /**
   * Expédition : sortie physique TRANSFER_OUT et libération de la réservation,
   * dans le même verrou de ligne.
   */
  async recordTransferOut(tx: PrismaTx, input: RecordTransferOutInput): Promise<MovementWriteResult> {
    assertPositiveInteger(input.quantityShipped);
    assertNonNegativeInteger(input.quantityReservedRelease);
    await assertWarehousePresent(tx, input.warehouseId);

    const locked = await lockStockLevel(tx, input.productId, input.warehouseId, null);
    const previousOnHand = locked?.quantityOnHand ?? 0;
    const previousReserved = locked?.quantityReserved ?? 0;
    if (previousOnHand < input.quantityShipped) {
      throw insufficientStock();
    }
    if (previousReserved < input.quantityReservedRelease) {
      throw new ApiException(
        STOCK_MOVEMENTS_ERROR.INSUFFICIENT_STOCK,
        "Réservation entrepôt insuffisante pour libérer cette expédition.",
        HttpStatus.CONFLICT,
      );
    }

    const nextOnHand = previousOnHand - input.quantityShipped;
    const nextReserved = previousReserved - input.quantityReservedRelease;

    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        movementType: MovementType.TRANSFER_OUT,
        quantity: input.quantityShipped,
        direction: MovementDirection.OUT,
        warehouseId: input.warehouseId,
        storeId: null,
        unitCost: input.unitCost,
        sourceType: STOCK_SOURCE_TYPE.TRANSFER,
        sourceId: input.transferId,
        createdById: input.createdById,
        note: input.note ?? null,
      },
      select: { id: true },
    });

    if (!locked) {
      throw insufficientStock();
    }
    await tx.stockLevel.update({
      where: { id: locked.id },
      data: { quantityOnHand: nextOnHand, quantityReserved: nextReserved },
    });

    await this.notifyAfterMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      storeId: null,
      previousOnHand,
      nextOnHand,
    });

    return { movementId: movement.id, quantityOnHand: nextOnHand, previousOnHand };
  }

  async recordTransferIn(tx: PrismaTx, input: RecordTransferInInput): Promise<MovementWriteResult> {
    return this.recordMovement(tx, {
      productId: input.productId,
      warehouseId: null,
      storeId: input.storeId,
      movementType: MovementType.TRANSFER_IN,
      direction: MovementDirection.IN,
      quantity: input.quantity,
      sourceType: STOCK_SOURCE_TYPE.TRANSFER,
      sourceId: input.transferId,
      createdById: input.createdById,
      unitCost: input.unitCost,
      note: input.note ?? null,
    });
  }

  async recordInternalIssue(tx: PrismaTx, input: RecordInternalIssueInput): Promise<MovementWriteResult> {
    assertExclusiveLocation(input.warehouseId, input.storeId);
    return this.recordMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId ?? null,
      storeId: input.storeId ?? null,
      movementType: MovementType.INTERNAL_ISSUE,
      direction: MovementDirection.OUT,
      quantity: input.quantity,
      sourceType: STOCK_SOURCE_TYPE.INTERNAL_ISSUE,
      sourceId: input.internalIssueId,
      createdById: input.createdById,
      note: input.note ?? null,
    });
  }

  async recordSale(tx: PrismaTx, input: RecordSaleInput): Promise<MovementWriteResult> {
    return this.recordMovement(tx, {
      productId: input.productId,
      warehouseId: null,
      storeId: input.storeId,
      movementType: MovementType.SALE,
      direction: MovementDirection.OUT,
      quantity: input.quantity,
      sourceType: STOCK_SOURCE_TYPE.SALE,
      sourceId: input.saleId,
      createdById: input.createdById,
      note: input.note ?? null,
    });
  }

  async recordSaleReversal(tx: PrismaTx, input: RecordSaleReversalInput): Promise<MovementWriteResult> {
    return this.recordMovement(tx, {
      productId: input.productId,
      warehouseId: null,
      storeId: input.storeId,
      movementType: MovementType.SALE_REVERSAL,
      direction: MovementDirection.IN,
      quantity: input.quantity,
      sourceType: STOCK_SOURCE_TYPE.SALE,
      sourceId: input.saleId,
      createdById: input.createdById,
      note: input.note ?? null,
    });
  }

  /**
   * Écrivain unique des soldes : append-only sur `stock_movements`, mise à jour `stock_levels` après verrou.
   */
  async recordMovement(tx: PrismaTx, input: RecordMovementInput): Promise<MovementWriteResult> {
    assertExclusiveLocation(input.warehouseId, input.storeId);
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new ApiException(
        STOCK_MOVEMENTS_ERROR.INVALID_QUANTITY,
        "La quantité du mouvement doit être un entier strictement positif.",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.direction === MovementDirection.IN && input.warehouseId) {
      await assertWarehousePresent(tx, input.warehouseId);
    }
    if (input.direction === MovementDirection.IN && input.storeId) {
      await assertStorePresent(tx, input.storeId);
    }

    const lockedLevel = await lockStockLevel(tx, input.productId, input.warehouseId, input.storeId);
    const previousOnHand = lockedLevel?.quantityOnHand ?? 0;
    const delta = input.direction === MovementDirection.IN ? input.quantity : -input.quantity;
    const nextOnHand = previousOnHand + delta;

    if (nextOnHand < 0) {
      throw new ApiException(
        STOCK_MOVEMENTS_ERROR.INSUFFICIENT_STOCK,
        "Stock insuffisant pour ce mouvement.",
        HttpStatus.CONFLICT,
      );
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        movementType: input.movementType,
        quantity: input.quantity,
        direction: input.direction,
        warehouseId: input.warehouseId,
        storeId: input.storeId,
        unitCost: input.unitCost ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdById: input.createdById,
        note: input.note ?? null,
      },
      select: { id: true },
    });

    if (lockedLevel) {
      await tx.stockLevel.update({
        where: { id: lockedLevel.id },
        data: { quantityOnHand: nextOnHand },
      });
    } else {
      await tx.stockLevel.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          storeId: input.storeId,
          quantityOnHand: nextOnHand,
          quantityReserved: 0,
        },
      });
    }

    await this.notifyAfterMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      storeId: input.storeId,
      previousOnHand,
      nextOnHand,
    });

    return { movementId: movement.id, quantityOnHand: nextOnHand, previousOnHand };
  }

  private async notifyAfterMovement(
    tx: PrismaTx,
    input: {
      productId: string;
      warehouseId: string | null;
      storeId: string | null;
      previousOnHand: number;
      nextOnHand: number;
    },
  ): Promise<void> {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      select: { reference: true, name: true },
    });
    const locationLabel = await resolveLocationLabel(tx, input.warehouseId, input.storeId);
    const effectiveThreshold = await this.stockAlerts.resolveEffectiveThreshold(tx, input.productId);
    await this.stockAlerts.evaluateAfterMovement(tx, {
      productId: input.productId,
      reference: product.reference,
      name: product.name,
      storeId: input.storeId,
      locationLabel,
      previousOnHand: input.previousOnHand,
      nextOnHand: input.nextOnHand,
      effectiveThreshold,
    });
  }

  /** Verrouille la ligne de solde (préparation ventes / transferts). */
  async lockLevelForUpdate(
    tx: PrismaTx,
    productId: string,
    warehouseId: string | null,
    storeId: string | null,
  ): Promise<StockLevel | null> {
    assertExclusiveLocation(warehouseId, storeId);
    return lockStockLevel(tx, productId, warehouseId, storeId);
  }
}

function assertPositiveInteger(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ApiException(
      STOCK_MOVEMENTS_ERROR.INVALID_QUANTITY,
      "La quantité du mouvement doit être un entier strictement positif.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertNonNegativeInteger(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ApiException(
      STOCK_MOVEMENTS_ERROR.INVALID_QUANTITY,
      "La quantité réservée à libérer doit être un entier positif ou nul.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

function insufficientStock(): ApiException {
  return new ApiException(
    STOCK_MOVEMENTS_ERROR.INSUFFICIENT_STOCK,
    "Stock insuffisant pour ce mouvement.",
    HttpStatus.CONFLICT,
  );
}

function assertExclusiveLocation(warehouseId: string | null | undefined, storeId: string | null | undefined): void {
  const hasWarehouse = Boolean(warehouseId);
  const hasStore = Boolean(storeId);
  if (hasWarehouse === hasStore) {
    throw new ApiException(
      STOCK_MOVEMENTS_ERROR.LOCATION_EXCLUSIVE,
      "Un mouvement doit cibler soit l'entrepôt, soit une boutique — pas les deux ni aucun.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

async function assertWarehousePresent(tx: PrismaTx, warehouseId: string): Promise<void> {
  const row = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true } });
  if (!row) {
    throw new ApiException(
      STOCK_MOVEMENTS_ERROR.WAREHOUSE_REQUIRED,
      "Entrepôt introuvable.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

async function assertStorePresent(tx: PrismaTx, storeId: string): Promise<void> {
  const row = await tx.store.findUnique({ where: { id: storeId }, select: { id: true } });
  if (!row) {
    throw new ApiException(
      STOCK_MOVEMENTS_ERROR.STORE_REQUIRED,
      "Boutique introuvable.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

async function lockStockLevel(
  tx: PrismaTx,
  productId: string,
  warehouseId: string | null,
  storeId: string | null,
): Promise<StockLevel | null> {
  if (warehouseId) {
    const rows = await tx.$queryRaw<StockLevel[]>`
      SELECT id, product_id as "productId", warehouse_id as "warehouseId", store_id as "storeId",
             quantity_on_hand as "quantityOnHand", quantity_reserved as "quantityReserved",
             updated_at as "updatedAt"
      FROM stock_levels
      WHERE product_id = ${productId}::uuid
        AND warehouse_id = ${warehouseId}::uuid
        AND store_id IS NULL
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }
  if (storeId) {
    const rows = await tx.$queryRaw<StockLevel[]>`
      SELECT id, product_id as "productId", warehouse_id as "warehouseId", store_id as "storeId",
             quantity_on_hand as "quantityOnHand", quantity_reserved as "quantityReserved",
             updated_at as "updatedAt"
      FROM stock_levels
      WHERE product_id = ${productId}::uuid
        AND store_id = ${storeId}::uuid
        AND warehouse_id IS NULL
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }
  return null;
}

async function resolveLocationLabel(
  tx: PrismaTx,
  warehouseId: string | null,
  storeId: string | null,
): Promise<string> {
  if (warehouseId) {
    const wh = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { code: true } });
    return wh ? `Entrepôt ${wh.code}` : "Entrepôt";
  }
  if (storeId) {
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { code: true } });
    return store ? `Boutique ${store.code}` : "Boutique";
  }
  return "Lieu";
}