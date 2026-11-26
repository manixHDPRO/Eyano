import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, ReferentialStatus, type Warehouse } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { emptyToNull } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WAREHOUSE_ERROR } from "./warehouses.constants";

export type WarehouseDetail = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: ReferentialStatus;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(): Promise<{ items: WarehouseDetail[] }> {
    const rows = await this.prisma.warehouse.findMany({
      orderBy: [{ status: "asc" }, { code: "asc" }],
    });
    return { items: rows.map(toDetail) };
  }

  async findOne(id: string): Promise<WarehouseDetail> {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw notFound();
    }
    return toDetail(warehouse);
  }

  async update(actor: AuthUser, id: string, dto: UpdateWarehouseDto, meta: RequestMeta): Promise<WarehouseDetail> {
    const current = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!current) {
      throw notFound();
    }

    if (dto.status === ReferentialStatus.INACTIVE) {
      const otherActive = await this.prisma.warehouse.count({
        where: { id: { not: id }, status: ReferentialStatus.ACTIVE },
      });
      if (otherActive === 0) {
        throw new ApiException(
          WAREHOUSE_ERROR.CANNOT_DEACTIVATE,
          "L’entrepôt central ne peut pas être désactivé : un entrepôt reste obligatoire en version 1.",
          HttpStatus.CONFLICT,
        );
      }
    }

    const data: Prisma.WarehouseUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.address !== undefined ? { address: emptyToNull(dto.address) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.warehouse.update({ where: { id }, data });
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.WAREHOUSE_UPDATED,
          entityType: AUDIT_ENTITY.WAREHOUSE,
          entityId: id,
          oldValue: warehouseSnapshot(current),
          newValue: warehouseSnapshot(next),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      return next;
    });

    return toDetail(updated);
  }
}

function notFound(): ApiException {
  return new ApiException(WAREHOUSE_ERROR.NOT_FOUND, "Entrepôt introuvable.", HttpStatus.NOT_FOUND);
}

function warehouseSnapshot(warehouse: Warehouse) {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    status: warehouse.status,
  };
}

function toDetail(warehouse: Warehouse): WarehouseDetail {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    status: warehouse.status,
    createdAt: warehouse.createdAt.toISOString(),
    updatedAt: warehouse.updatedAt.toISOString(),
  };
}
