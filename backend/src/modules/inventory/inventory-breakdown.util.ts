import { MovementDirection, MovementType, type StockMovement } from "@prisma/client";

export type MovementBreakdownBuckets = {
  receiptsQty: number;
  transfersInQty: number;
  transfersOutQty: number;
  salesQty: number;
  internalIssuesQty: number;
  adjustmentsQty: number;
};

export type FrozenInventorySnapshot = MovementBreakdownBuckets & {
  initialQty: number;
  theoreticalQty: number;
};

export function aggregateMovementBreakdown(
  movements: Pick<StockMovement, "movementType" | "direction" | "quantity">[],
): MovementBreakdownBuckets {
  const buckets: MovementBreakdownBuckets = {
    receiptsQty: 0,
    transfersInQty: 0,
    transfersOutQty: 0,
    salesQty: 0,
    internalIssuesQty: 0,
    adjustmentsQty: 0,
  };

  for (const row of movements) {
    const qty = row.quantity;
    switch (row.movementType) {
      case MovementType.GOODS_RECEIPT:
        if (row.direction === MovementDirection.IN) {
          buckets.receiptsQty += qty;
        }
        break;
      case MovementType.TRANSFER_IN:
        if (row.direction === MovementDirection.IN) {
          buckets.transfersInQty += qty;
        }
        break;
      case MovementType.TRANSFER_OUT:
        if (row.direction === MovementDirection.OUT) {
          buckets.transfersOutQty += qty;
        }
        break;
      case MovementType.SALE:
      case MovementType.SALE_REVERSAL:
        if (row.direction === MovementDirection.OUT) {
          buckets.salesQty += qty;
        } else if (row.direction === MovementDirection.IN) {
          buckets.salesQty -= qty;
        }
        break;
      case MovementType.INTERNAL_ISSUE:
        if (row.direction === MovementDirection.OUT) {
          buckets.internalIssuesQty += qty;
        }
        break;
      case MovementType.INVENTORY_ADJUSTMENT:
      case MovementType.MANUAL_ADJUSTMENT:
        if (row.direction === MovementDirection.IN) {
          buckets.adjustmentsQty += qty;
        } else {
          buckets.adjustmentsQty -= qty;
        }
        break;
      default: {
        const _exhaustive: never = row.movementType;
        void _exhaustive;
      }
    }
  }

  return buckets;
}

/** Aligne le détail figé avec le solde actuel (grand livre cohérent). */
export function buildFrozenSnapshot(quantityOnHand: number, buckets: MovementBreakdownBuckets): FrozenInventorySnapshot {
  const net =
    buckets.receiptsQty +
    buckets.transfersInQty -
    buckets.salesQty -
    buckets.transfersOutQty -
    buckets.internalIssuesQty +
    buckets.adjustmentsQty;
  const initialQty = quantityOnHand - net;
  return {
    ...buckets,
    initialQty,
    theoreticalQty: quantityOnHand,
  };
}