import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, ReferentialStatus, type CashRegister, type Store } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { emptyToNull, isPrismaUniqueViolation, isValidReferentialCode, normalizeReferentialCode } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { CreateStoreDto } from "./dto/create-store.dto";
import type { DeleteStoresDto } from "./dto/delete-stores.dto";
import type { ListStoresQueryDto } from "./dto/list-stores.query.dto";
import type { UpdateStoreDto } from "./dto/update-store.dto";
import { DEFAULT_CASH_REGISTER_CODE, DEFAULT_CASH_REGISTER_NAME, STORES_ERROR } from "./stores.constants";

type PrismaTx = Prisma.TransactionClient;

export type StoreDeleteSummary = {
  id: string;
  code: string;
  name: string;
};

export type BulkDeleteStoresResult = {
  deleted: StoreDeleteSummary[];
  skipped: Array<StoreDeleteSummary & { reason: string }>;
};

export type StoreOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
};

export type CashRegisterSummary = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  status: ReferentialStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoreListItem = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  status: ReferentialStatus;
  defaultCashRegister: { id: string; code: string; name: string } | null;
  cashRegisterCount: number;
  staffCount: number;
  updatedAt: string;
};

export type StoreDetail = StoreListItem & {
  receiptHeader: string | null;
  receiptFooter: string | null;
  cashRegisters: CashRegisterSummary[];
  createdAt: string;
};

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async listForAssignment() {
    const rows = await this.prisma.store.findMany({
      where: { status: ReferentialStatus.ACTIVE },
      orderBy: { name: "asc" },
    });
    const items: StoreOption[] = rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      city: row.city,
    }));
    return { items };
  }

  async list(query: ListStoresQueryDto) {
    const where: Prisma.StoreWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { code: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [total, rows, active, inactive, cashRegisters] = await this.prisma.$transaction([
      this.prisma.store.count({ where }),
      this.prisma.store.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: {
          cashRegisters: { orderBy: [{ isDefault: "desc" }, { code: "asc" }] },
          _count: { select: { cashRegisters: true, storeUsers: true } },
        },
      }),
      this.prisma.store.count({ where: { status: ReferentialStatus.ACTIVE } }),
      this.prisma.store.count({ where: { status: ReferentialStatus.INACTIVE } }),
      this.prisma.cashRegister.count(),
    ]);

    const items: StoreListItem[] = rows.map((row) => toListItem(row));
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      stats: { active, inactive, cashRegisters },
    };
  }

  async findOne(id: string): Promise<StoreDetail> {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        cashRegisters: { orderBy: [{ isDefault: "desc" }, { code: "asc" }] },
        _count: { select: { cashRegisters: true, storeUsers: true } },
      },
    });
    if (!store) {
      throw notFound();
    }
    return toDetail(store);
  }

  async create(actor: AuthUser, dto: CreateStoreDto, meta: RequestMeta): Promise<StoreDetail> {
    const code = normalizeReferentialCode(dto.code);
    if (!isValidReferentialCode(code)) {
      throw new ApiException(STORES_ERROR.INVALID_CODE, "Code boutique invalide.", HttpStatus.BAD_REQUEST);
    }
    const existing = await this.prisma.store.findUnique({ where: { code } });
    if (existing) {
      throw codeTaken();
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const store = await tx.store.create({
          data: {
            code,
            name: dto.name.trim(),
            address: emptyToNull(dto.address),
            city: emptyToNull(dto.city),
            phone: emptyToNull(dto.phone),
            receiptHeader: emptyToNull(dto.receiptHeader),
            receiptFooter: emptyToNull(dto.receiptFooter),
            status: ReferentialStatus.ACTIVE,
          },
        });
        const register = await tx.cashRegister.create({
          data: {
            storeId: store.id,
            code: DEFAULT_CASH_REGISTER_CODE,
            name: DEFAULT_CASH_REGISTER_NAME,
            isDefault: true,
            status: ReferentialStatus.ACTIVE,
          },
        });
        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.STORE_CREATED,
            entityType: AUDIT_ENTITY.STORE,
            entityId: store.id,
            storeId: store.id,
            newValue: {
              store: storeSnapshot(store),
              defaultCashRegister: cashRegisterSnapshot(register),
            },
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
        return { store, register };
      });

      return toDetail({
        ...created.store,
        cashRegisters: [created.register],
        _count: { cashRegisters: 1, storeUsers: 0 },
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw codeTaken();
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateStoreDto, meta: RequestMeta): Promise<StoreDetail> {
    const current = await this.prisma.store.findUnique({ where: { id } });
    if (!current) {
      throw notFound();
    }

    const nextCode = dto.code !== undefined ? normalizeReferentialCode(dto.code) : current.code;
    if (!isValidReferentialCode(nextCode)) {
      throw new ApiException(STORES_ERROR.INVALID_CODE, "Code boutique invalide.", HttpStatus.BAD_REQUEST);
    }
    if (nextCode !== current.code) {
      const clash = await this.prisma.store.findUnique({ where: { code: nextCode } });
      if (clash) {
        throw codeTaken();
      }
    }

    const data: Prisma.StoreUpdateInput = {
      ...(dto.code !== undefined ? { code: nextCode } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.address !== undefined ? { address: emptyToNull(dto.address) } : {}),
      ...(dto.city !== undefined ? { city: emptyToNull(dto.city) } : {}),
      ...(dto.phone !== undefined ? { phone: emptyToNull(dto.phone) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.receiptHeader !== undefined ? { receiptHeader: emptyToNull(dto.receiptHeader) } : {}),
      ...(dto.receiptFooter !== undefined ? { receiptFooter: emptyToNull(dto.receiptFooter) } : {}),
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.store.update({ where: { id }, data });
        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.STORE_UPDATED,
            entityType: AUDIT_ENTITY.STORE,
            entityId: id,
            storeId: id,
            oldValue: storeSnapshot(current),
            newValue: storeSnapshot(updated),
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw codeTaken();
      }
      throw error;
    }

    return this.findOne(id);
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<StoreDeleteSummary> {
    const current = await this.prisma.store.findUnique({ where: { id } });
    if (!current) {
      throw notFound();
    }

    const summary = { id: current.id, code: current.code, name: current.name };

    await this.prisma.$transaction(async (tx) => {
      await assertStoreDeletable(tx, id);
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.STORE_DELETED,
          entityType: AUDIT_ENTITY.STORE,
          entityId: id,
          storeId: null,
          oldValue: storeSnapshot(current),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      await purgeStoreReferentials(tx, id);
      await tx.store.delete({ where: { id } });
    });

    return summary;
  }

  async removeMany(actor: AuthUser, dto: DeleteStoresDto, meta: RequestMeta): Promise<BulkDeleteStoresResult> {
    const uniqueIds = [...new Set(dto.ids)];
    const deleted: StoreDeleteSummary[] = [];
    const skipped: Array<StoreDeleteSummary & { reason: string }> = [];

    for (const id of uniqueIds) {
      try {
        const item = await this.remove(actor, id, meta);
        deleted.push(item);
      } catch (error) {
        const reason =
          error instanceof ApiException ? error.message : "Suppression refusée pour cette boutique.";
        const row = await this.prisma.store.findUnique({
          where: { id },
          select: { id: true, code: true, name: true },
        });
        skipped.push({
          id,
          code: row?.code ?? "—",
          name: row?.name ?? "Boutique introuvable",
          reason,
        });
      }
    }

    return { deleted, skipped };
  }
}

async function assertStoreDeletable(tx: PrismaTx, storeId: string): Promise<void> {
  const registers = await tx.cashRegister.findMany({ where: { storeId }, select: { id: true } });
  const registerIds = registers.map((row) => row.id);

  const [sales, transfers, expenses, inventorySessions, internalIssues, stockMovements, cashSessions] =
    await Promise.all([
      tx.sale.count({ where: { storeId } }),
      tx.transfer.count({ where: { storeId } }),
      tx.expense.count({ where: { storeId } }),
      tx.inventorySession.count({ where: { storeId } }),
      tx.internalStockIssue.count({ where: { storeId } }),
      tx.stockMovement.count({ where: { storeId } }),
      registerIds.length > 0
        ? tx.cashSession.count({ where: { cashRegisterId: { in: registerIds } } })
        : Promise.resolve(0),
    ]);

  const blocked = sales + transfers + expenses + inventorySessions + internalIssues + stockMovements + cashSessions;
  if (blocked > 0) {
    throw hasDependencies();
  }
}

async function purgeStoreReferentials(tx: PrismaTx, storeId: string): Promise<void> {
  await tx.notification.deleteMany({ where: { storeId } });
  await tx.auditLog.deleteMany({ where: { storeId } });
  await tx.productStore.deleteMany({ where: { storeId } });
  await tx.stockLevel.deleteMany({ where: { storeId } });
  await tx.storeUser.deleteMany({ where: { storeId } });
  await tx.cashRegister.deleteMany({ where: { storeId } });
}

function notFound(): ApiException {
  return new ApiException(STORES_ERROR.NOT_FOUND, "Boutique introuvable.", HttpStatus.NOT_FOUND);
}

function codeTaken(): ApiException {
  return new ApiException(STORES_ERROR.CODE_TAKEN, "Ce code boutique est déjà utilisé.", HttpStatus.CONFLICT);
}

function hasDependencies(): ApiException {
  return new ApiException(
    STORES_ERROR.HAS_DEPENDENCIES,
    "Impossible de supprimer cette boutique : des ventes, transferts, sessions de caisse ou autres opérations y sont encore rattachées.",
    HttpStatus.CONFLICT,
  );
}

function storeSnapshot(store: Store) {
  return {
    id: store.id,
    code: store.code,
    name: store.name,
    address: store.address,
    city: store.city,
    phone: store.phone,
    status: store.status,
    receiptHeader: store.receiptHeader,
    receiptFooter: store.receiptFooter,
  };
}

function cashRegisterSnapshot(register: CashRegister) {
  return {
    id: register.id,
    storeId: register.storeId,
    code: register.code,
    name: register.name,
    isDefault: register.isDefault,
    status: register.status,
  };
}

type StoreWithRegisters = Store & {
  cashRegisters: CashRegister[];
  _count: { cashRegisters: number; storeUsers: number };
};

function toListItem(store: StoreWithRegisters): StoreListItem {
  const defaultRegister = store.cashRegisters.find((row) => row.isDefault) ?? store.cashRegisters[0] ?? null;
  return {
    id: store.id,
    code: store.code,
    name: store.name,
    address: store.address,
    city: store.city,
    phone: store.phone,
    status: store.status,
    defaultCashRegister: defaultRegister
      ? { id: defaultRegister.id, code: defaultRegister.code, name: defaultRegister.name }
      : null,
    cashRegisterCount: store._count.cashRegisters,
    staffCount: store._count.storeUsers,
    updatedAt: store.updatedAt.toISOString(),
  };
}

function toDetail(store: StoreWithRegisters): StoreDetail {
  return {
    ...toListItem(store),
    receiptHeader: store.receiptHeader,
    receiptFooter: store.receiptFooter,
    createdAt: store.createdAt.toISOString(),
    cashRegisters: store.cashRegisters.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isDefault: row.isDefault,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}
