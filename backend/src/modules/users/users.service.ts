import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "../auth/password.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { ListUsersQueryDto } from "./dto/list-users.query.dto";
import type { SetUserStoresDto } from "./dto/set-user-stores.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import { USERS_ERROR } from "./users.constants";
import { UsersPolicyService } from "./users-policy.service";

export type UserListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  role: { id: string; code: string; name: string };
  storeCount: number;
  updatedAt: string;
};

export type UserDetail = UserListItem & {
  stores: { id: string; code: string; name: string; isPrimary: boolean }[];
  createdAt: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly policy: UsersPolicyService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.roleId) {
      where.roleId = query.roleId;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: {
          role: true,
          _count: { select: { storeMemberships: true } },
        },
      }),
    ]);

    const items: UserListItem[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      status: row.status,
      role: { id: row.role.id, code: row.role.code, name: row.role.name },
      storeCount: row._count.storeMemberships,
      updatedAt: row.updatedAt.toISOString(),
    }));

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(id: string): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        storeMemberships: {
          include: { store: true },
          orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
        },
        _count: { select: { storeMemberships: true } },
      },
    });
    if (!user) {
      throw notFound();
    }
    return toDetail(user);
  }

  async create(actor: AuthUser, dto: CreateUserDto, meta: RequestMeta): Promise<UserDetail> {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new ApiException(USERS_ERROR.NOT_FOUND, "Rôle introuvable.", HttpStatus.BAD_REQUEST);
    }
    this.policy.assertRoleAssignable(actor, role.code);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiException(USERS_ERROR.EMAIL_TAKEN, "Cet e-mail est déjà utilisé.", HttpStatus.CONFLICT);
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        roleId: role.id,
        status: UserStatus.ACTIVE,
        passwordChangedAt: new Date(),
      },
      include: {
        role: true,
        storeMemberships: { include: { store: true } },
        _count: { select: { storeMemberships: true } },
      },
    });
    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.USER_CREATED,
      entityType: AUDIT_ENTITY.USER,
      entityId: created.id,
      newValue: { email: created.email, role: role.code },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toDetail(created);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto, meta: RequestMeta): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw notFound();
    }
    this.policy.assertActorCanManageTarget(actor, user.role.code);

    let nextRoleId = user.roleId;
    if (dto.roleId && dto.roleId !== user.roleId) {
      const nextRole = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!nextRole) {
        throw new ApiException(USERS_ERROR.NOT_FOUND, "Rôle introuvable.", HttpStatus.BAD_REQUEST);
      }
      this.policy.assertRoleAssignable(actor, nextRole.code);
      if (user.role.code === "SUPER_ADMIN" && nextRole.code !== "SUPER_ADMIN") {
        await this.policy.assertSuperAdminSurvival(user.id, nextRole.code);
      }
      nextRoleId = nextRole.id;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.roleId !== undefined ? { roleId: nextRoleId } : {}),
      },
      include: {
        role: true,
        storeMemberships: { include: { store: true }, orderBy: [{ isPrimary: "desc" }] },
        _count: { select: { storeMemberships: true } },
      },
    });
    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.USER_UPDATED,
      entityType: AUDIT_ENTITY.USER,
      entityId: id,
      oldValue: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role.code,
      },
      newValue: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        role: updated.role.code,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toDetail(updated);
  }

  async deactivate(actor: AuthUser, id: string, meta: RequestMeta): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw notFound();
    }
    await this.policy.assertCanDeactivate(actor, id, user.role.code);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
      include: {
        role: true,
        storeMemberships: { include: { store: true } },
        _count: { select: { storeMemberships: true } },
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.write({
      actorId: actor.id,
      action: AUDIT_ACTION.USER_DEACTIVATED,
      entityType: AUDIT_ENTITY.USER,
      entityId: id,
      oldValue: { status: user.status, email: user.email },
      newValue: { status: UserStatus.INACTIVE },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toDetail(updated);
  }

  async setStores(actor: AuthUser, userId: string, dto: SetUserStoresDto, meta: RequestMeta): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw notFound();
    }
    this.policy.assertActorCanManageTarget(actor, user.role.code);

    const storeIds = dto.stores.map((row) => row.storeId);
    const stores = await this.prisma.store.findMany({ where: { id: { in: storeIds } } });
    if (stores.length !== storeIds.length) {
      throw new ApiException(USERS_ERROR.STORE_NOT_FOUND, "Une ou plusieurs boutiques sont introuvables.", HttpStatus.BAD_REQUEST);
    }

    const primaryCount = dto.stores.filter((row) => row.isPrimary === true).length;
    if (primaryCount > 1) {
      throw new ApiException(
        USERS_ERROR.INVALID_PRIMARY_STORE,
        "Une seule boutique principale est autorisée.",
        HttpStatus.BAD_REQUEST,
      );
    }

    let primaryId = dto.stores.find((row) => row.isPrimary)?.storeId;
    if (!primaryId && dto.stores.length === 1) {
      primaryId = dto.stores[0]?.storeId;
    }

    const previous = await this.prisma.storeUser.findMany({
      where: { userId },
      select: { storeId: true, isPrimary: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.storeUser.deleteMany({ where: { userId } });
      if (dto.stores.length > 0) {
        await tx.storeUser.createMany({
          data: dto.stores.map((row) => ({
            userId,
            storeId: row.storeId,
            isPrimary: primaryId === row.storeId,
            assignedBy: actor.id,
          })),
        });
      }
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.USER_STORES_UPDATED,
          entityType: AUDIT_ENTITY.USER,
          entityId: userId,
          oldValue: { stores: previous },
          newValue: { stores: dto.stores.map((row) => ({ storeId: row.storeId, isPrimary: primaryId === row.storeId })) },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(userId);
  }
}

function notFound(): ApiException {
  return new ApiException(USERS_ERROR.NOT_FOUND, "Utilisateur introuvable.", HttpStatus.NOT_FOUND);
}

function toDetail(
  user: Prisma.UserGetPayload<{
    include: {
      role: true;
      storeMemberships: { include: { store: true } };
      _count: { select: { storeMemberships: true } };
    };
  }>,
): UserDetail {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    role: { id: user.role.id, code: user.role.code, name: user.role.name },
    storeCount: user._count.storeMemberships,
    updatedAt: user.updatedAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
    stores: user.storeMemberships.map((row) => ({
      id: row.store.id,
      code: row.store.code,
      name: row.store.name,
      isPrimary: row.isPrimary,
    })),
  };
}