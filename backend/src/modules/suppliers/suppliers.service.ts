import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, ReferentialStatus, type Supplier } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { emptyToNull } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { CreateSupplierDto } from "./dto/create-supplier.dto";
import type { ListSuppliersQueryDto } from "./dto/list-suppliers.query.dto";
import type { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SUPPLIERS_ERROR } from "./suppliers.constants";

export type SupplierListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  status: ReferentialStatus;
  receiptCount: number;
  updatedAt: string;
};

export type SupplierDetail = SupplierListItem & {
  address: string | null;
  createdAt: string;
};

export type SupplierOption = {
  id: string;
  name: string;
  status: ReferentialStatus;
};

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: ListSuppliersQueryDto) {
    const where: Prisma.SupplierWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total, active, inactive] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: { _count: { select: { goodsReceipts: true } } },
      }),
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.count({ where: { status: ReferentialStatus.ACTIVE } }),
      this.prisma.supplier.count({ where: { status: ReferentialStatus.INACTIVE } }),
    ]);

    return {
      items: rows.map((row) => toListItem(row, row._count.goodsReceipts)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      stats: { active, inactive },
    };
  }

  async options(): Promise<{ items: SupplierOption[] }> {
    const rows = await this.prisma.supplier.findMany({
      where: { status: ReferentialStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    });
    return { items: rows };
  }

  async findOne(id: string): Promise<SupplierDetail> {
    const row = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { goodsReceipts: true } } },
    });
    if (!row) {
      throw notFound();
    }
    return toDetail(row, row._count.goodsReceipts);
  }

  async create(actor: AuthUser, dto: CreateSupplierDto, meta: RequestMeta): Promise<SupplierDetail> {
    const created = await this.prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        phone: emptyToNull(dto.phone),
        email: emptyToNull(dto.email),
        address: emptyToNull(dto.address),
        country: emptyToNull(dto.country),
        status: ReferentialStatus.ACTIVE,
      },
      include: { _count: { select: { goodsReceipts: true } } },
    });

    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.SUPPLIER_CREATED,
      entityType: AUDIT_ENTITY.SUPPLIER,
      entityId: created.id,
      newValue: toDetail(created, created._count.goodsReceipts),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toDetail(created, created._count.goodsReceipts);
  }

  async update(actor: AuthUser, id: string, dto: UpdateSupplierDto, meta: RequestMeta): Promise<SupplierDetail> {
    const current = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { goodsReceipts: true } } },
    });
    if (!current) {
      throw notFound();
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : emptyToNull(dto.phone),
        email: dto.email === undefined ? undefined : emptyToNull(dto.email),
        address: dto.address === undefined ? undefined : emptyToNull(dto.address),
        country: dto.country === undefined ? undefined : emptyToNull(dto.country),
        status: dto.status,
      },
      include: { _count: { select: { goodsReceipts: true } } },
    });

    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.SUPPLIER_UPDATED,
      entityType: AUDIT_ENTITY.SUPPLIER,
      entityId: id,
      oldValue: toDetail(current, current._count.goodsReceipts),
      newValue: toDetail(updated, updated._count.goodsReceipts),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toDetail(updated, updated._count.goodsReceipts);
  }

}

function notFound(): ApiException {
  return new ApiException(SUPPLIERS_ERROR.NOT_FOUND, "Fournisseur introuvable.", HttpStatus.NOT_FOUND);
}

function toListItem(row: Supplier, receiptCount: number): SupplierListItem {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    country: row.country,
    status: row.status,
    receiptCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: Supplier, receiptCount: number): SupplierDetail {
  return {
    ...toListItem(row, receiptCount),
    address: row.address,
    createdAt: row.createdAt.toISOString(),
  };
}