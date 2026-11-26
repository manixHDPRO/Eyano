import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, ReferentialStatus, type CashRegister } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { isPrismaUniqueViolation, isValidReferentialCode, normalizeReferentialCode } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CASH_REGISTER_ERROR } from "./cash-registers.constants";
import type { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import type { ListCashRegistersQueryDto } from "./dto/list-cash-registers.query.dto";
import type { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

export type CashRegisterDetail = {
  id: string;
  storeId: string;
  code: string;
  name: string;
  isDefault: boolean;
  status: ReferentialStatus;
  createdAt: string;
  updatedAt: string;
  store: { id: string; code: string; name: string; status: ReferentialStatus };
};

@Injectable()
export class CashRegistersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: ListCashRegistersQueryDto): Promise<{
    items: CashRegisterDetail[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const where: Prisma.CashRegisterWhereInput = {};
    if (query.storeId) {
      where.storeId = query.storeId;
    }
    if (query.status) {
      where.status = query.status;
    }
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.cashRegister.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ store: { name: "asc" } }, { isDefault: "desc" }, { code: "asc" }],
        include: { store: true },
      }),
      this.prisma.cashRegister.count({ where }),
    ]);
    return {
      items: rows.map(toDetail),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async create(actor: AuthUser, dto: CreateCashRegisterDto, meta: RequestMeta): Promise<CashRegisterDetail> {
    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) {
      throw new ApiException(CASH_REGISTER_ERROR.STORE_NOT_FOUND, "Boutique introuvable.", HttpStatus.BAD_REQUEST);
    }

    const code = normalizeReferentialCode(dto.code);
    if (!isValidReferentialCode(code)) {
      throw new ApiException(CASH_REGISTER_ERROR.INVALID_CODE, "Code caisse invalide.", HttpStatus.BAD_REQUEST);
    }

    const clash = await this.prisma.cashRegister.findUnique({
      where: { storeId_code: { storeId: dto.storeId, code } },
    });
    if (clash) {
      throw codeTaken();
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existingDefault = await tx.cashRegister.findFirst({
          where: { storeId: dto.storeId, isDefault: true },
        });
        const makeDefault = dto.isDefault === true || !existingDefault;
        if (makeDefault) {
          await tx.cashRegister.updateMany({
            where: { storeId: dto.storeId, isDefault: true },
            data: { isDefault: false },
          });
        }
        const register = await tx.cashRegister.create({
          data: {
            storeId: dto.storeId,
            code,
            name: dto.name.trim(),
            isDefault: makeDefault,
            status: ReferentialStatus.ACTIVE,
          },
          include: { store: true },
        });
        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.CASH_REGISTER_CREATED,
            entityType: AUDIT_ENTITY.CASH_REGISTER,
            entityId: register.id,
            storeId: dto.storeId,
            newValue: cashRegisterSnapshot(register),
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
        return register;
      });
      return toDetail(created);
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw codeTaken();
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateCashRegisterDto, meta: RequestMeta): Promise<CashRegisterDetail> {
    const current = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: { store: true },
    });
    if (!current) {
      throw notFound();
    }

    const nextCode = dto.code !== undefined ? normalizeReferentialCode(dto.code) : current.code;
    if (!isValidReferentialCode(nextCode)) {
      throw new ApiException(CASH_REGISTER_ERROR.INVALID_CODE, "Code caisse invalide.", HttpStatus.BAD_REQUEST);
    }
    if (nextCode !== current.code) {
      const clash = await this.prisma.cashRegister.findUnique({
        where: { storeId_code: { storeId: current.storeId, code: nextCode } },
      });
      if (clash) {
        throw codeTaken();
      }
    }

    const nextStatus = dto.status ?? current.status;
    if (dto.isDefault === true && nextStatus !== ReferentialStatus.ACTIVE) {
      throw new ApiException(
        CASH_REGISTER_ERROR.DEFAULT_REQUIRED,
        "La caisse par défaut doit rester active.",
        HttpStatus.CONFLICT,
      );
    }

    const losesDefault =
      (current.isDefault && dto.isDefault === false) ||
      (current.isDefault && nextStatus === ReferentialStatus.INACTIVE && current.status === ReferentialStatus.ACTIVE);

    if (losesDefault) {
      await assertSuccessor(this.prisma, current.storeId, id);
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (losesDefault) {
          const successor = await findSuccessor(tx, current.storeId, id);
          if (!successor) {
            throw new ApiException(
              CASH_REGISTER_ERROR.DEFAULT_REQUIRED,
              "Une boutique doit conserver une caisse par défaut active.",
              HttpStatus.CONFLICT,
            );
          }
          await tx.cashRegister.update({ where: { id }, data: { isDefault: false } });
          await tx.cashRegister.update({ where: { id: successor.id }, data: { isDefault: true } });
        } else if (dto.isDefault === true && !current.isDefault) {
          await tx.cashRegister.updateMany({
            where: { storeId: current.storeId, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }

        const next = await tx.cashRegister.update({
          where: { id },
          data: {
            ...(dto.code !== undefined ? { code: nextCode } : {}),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          },
          include: { store: true },
        });

        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.CASH_REGISTER_UPDATED,
            entityType: AUDIT_ENTITY.CASH_REGISTER,
            entityId: id,
            storeId: current.storeId,
            oldValue: cashRegisterSnapshot(current),
            newValue: cashRegisterSnapshot(next),
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
        return next;
      });
      return toDetail(updated);
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      if (isPrismaUniqueViolation(error)) {
        throw codeTaken();
      }
      throw error;
    }
  }
}

async function findSuccessor(
  client: Prisma.TransactionClient | PrismaService,
  storeId: string,
  exceptId: string,
) {
  return client.cashRegister.findFirst({
    where: {
      storeId,
      id: { not: exceptId },
      status: ReferentialStatus.ACTIVE,
    },
    orderBy: { code: "asc" },
  });
}

async function assertSuccessor(client: PrismaService, storeId: string, exceptId: string): Promise<void> {
  const successor = await findSuccessor(client, storeId, exceptId);
  if (!successor) {
    throw new ApiException(
      CASH_REGISTER_ERROR.DEFAULT_REQUIRED,
      "Une boutique doit conserver une caisse par défaut active.",
      HttpStatus.CONFLICT,
    );
  }
}

function notFound(): ApiException {
  return new ApiException(CASH_REGISTER_ERROR.NOT_FOUND, "Caisse introuvable.", HttpStatus.NOT_FOUND);
}

function codeTaken(): ApiException {
  return new ApiException(
    CASH_REGISTER_ERROR.CODE_TAKEN,
    "Ce code caisse est déjà utilisé dans cette boutique.",
    HttpStatus.CONFLICT,
  );
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

function toDetail(
  register: CashRegister & { store: { id: string; code: string; name: string; status: ReferentialStatus } },
): CashRegisterDetail {
  return {
    id: register.id,
    storeId: register.storeId,
    code: register.code,
    name: register.name,
    isDefault: register.isDefault,
    status: register.status,
    createdAt: register.createdAt.toISOString(),
    updatedAt: register.updatedAt.toISOString(),
    store: {
      id: register.store.id,
      code: register.store.code,
      name: register.store.name,
      status: register.store.status,
    },
  };
}
