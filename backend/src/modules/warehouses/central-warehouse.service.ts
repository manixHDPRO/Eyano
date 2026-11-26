import { HttpStatus, Injectable } from "@nestjs/common";
import { MovementDirection, ProductStatus, ReferentialStatus } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { GoodsReceiptsService } from "../suppliers/goods-receipts.service";
import { SETTING_STOCK_ALERT_DEFAULT } from "../stock-movements/stock-movements.constants";
import { StockQueryService } from "../stock-movements/stock-query.service";
import type { CentralWarehouseAdjustDto } from "./dto/central-warehouse-adjust.dto";
import type { CentralWarehouseReceiveDto } from "./dto/central-warehouse-receive.dto";
import { WAREHOUSE_ERROR } from "./warehouses.constants";

export type CentralWarehouseDashboard = {
  warehouse: { id: string; code: string; name: string };
  totalUnits: number;
  totalValuationUsd: number;
  lowStockCount: number;
  stockRows: Array<{
    productId: string;
    reference: string;
    name: string;
    purchasePriceUsd: number;
    alertThreshold: number;
    quantity: number;
    valuationUsd: number;
    isLowStock: boolean;
    isStockout: boolean;
  }>;
};

@Injectable()
export class CentralWarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goodsReceipts: GoodsReceiptsService,
    private readonly stockQuery: StockQueryService,
  ) {}

  async dashboard(): Promise<CentralWarehouseDashboard> {
    const warehouse = await resolveActiveCentralWarehouse(this.prisma);
    const defaultThreshold = await readDefaultThreshold(this.prisma);

    const [products, levels] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: { not: ProductStatus.ARCHIVED } },
        orderBy: [{ reference: "asc" }],
        select: {
          id: true,
          reference: true,
          name: true,
          purchasePrice: true,
          alertThreshold: true,
        },
      }),
      this.prisma.stockLevel.findMany({
        where: { warehouseId: warehouse.id, storeId: null },
        select: { productId: true, quantityOnHand: true },
      }),
    ]);

    const levelByProduct = new Map(levels.map((row) => [row.productId, row.quantityOnHand]));

    let totalUnits = 0;
    let totalValuationUsd = 0;

    const stockRows = products.map((product) => {
      const quantity = levelByProduct.get(product.id) ?? 0;
      const purchasePriceUsd = Number(product.purchasePrice);
      const alertThreshold = product.alertThreshold ?? defaultThreshold;
      const valuationUsd = Number((quantity * purchasePriceUsd).toFixed(2));
      totalUnits += quantity;
      totalValuationUsd += valuationUsd;
      const isStockout = quantity <= 0;
      const isLowStock = !isStockout && quantity <= alertThreshold;
      return {
        productId: product.id,
        reference: product.reference,
        name: product.name,
        purchasePriceUsd,
        alertThreshold,
        quantity,
        valuationUsd,
        isLowStock,
        isStockout,
      };
    });

    return {
      warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name },
      totalUnits,
      totalValuationUsd: Number(totalValuationUsd.toFixed(2)),
      lowStockCount: stockRows.filter((r) => r.isLowStock || r.isStockout).length,
      stockRows,
    };
  }

  async receive(actor: AuthUser, dto: CentralWarehouseReceiveDto, meta: RequestMeta) {
    const warehouse = await resolveActiveCentralWarehouse(this.prisma);
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, purchasePrice: true, status: true },
    });
    if (!product || product.status === ProductStatus.ARCHIVED) {
      throw new ApiException("PRODUCT_NOT_FOUND", "Produit introuvable.", HttpStatus.NOT_FOUND);
    }

    const created = await this.goodsReceipts.create(
      actor,
      {
        supplierId: dto.supplierId,
        warehouseId: warehouse.id,
        note: dto.notes?.trim() || "Réception marchandise entrepôt central",
        items: [
          {
            productId: dto.productId,
            quantity: dto.quantity,
            unitCost: Number(product.purchasePrice),
          },
        ],
      },
      meta,
    );

    return this.goodsReceipts.validate(actor, created.id, meta);
  }

  async adjust(actor: AuthUser, dto: CentralWarehouseAdjustDto, meta: RequestMeta) {
    const warehouse = await resolveActiveCentralWarehouse(this.prisma);
    const level = await this.prisma.stockLevel.findFirst({
      where: { productId: dto.productId, warehouseId: warehouse.id, storeId: null },
      select: { quantityOnHand: true },
    });
    const current = level?.quantityOnHand ?? 0;
    const delta = dto.newQuantity - current;
    if (delta === 0) {
      return { quantityOnHand: current, previousOnHand: current };
    }

    const note = dto.notes.trim();
    if (delta > 0) {
      return this.stockQuery.manualAdjustment(
        actor,
        {
          productId: dto.productId,
          warehouseId: warehouse.id,
          direction: MovementDirection.IN,
          quantity: delta,
          note,
        },
        meta,
      );
    }

    return this.stockQuery.manualAdjustment(
      actor,
      {
        productId: dto.productId,
        warehouseId: warehouse.id,
        direction: MovementDirection.OUT,
        quantity: Math.abs(delta),
        note,
      },
      meta,
    );
  }
}

async function resolveActiveCentralWarehouse(prisma: PrismaService) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { status: ReferentialStatus.ACTIVE },
    orderBy: [{ code: "asc" }],
  });
  if (!warehouse) {
    throw new ApiException(
      WAREHOUSE_ERROR.NOT_FOUND,
      "Entrepôt central introuvable. Relancez le seed structurel.",
      HttpStatus.NOT_FOUND,
    );
  }
  return warehouse;
}

async function readDefaultThreshold(prisma: PrismaService): Promise<number> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_STOCK_ALERT_DEFAULT } });
  return typeof setting?.value === "number" ? setting.value : 100;
}