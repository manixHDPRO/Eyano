import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";
import { PROTECTED_SUPER_ADMIN_PERMISSION, ROLES_ERROR } from "./roles.constants";

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async list() {
    const rows = await this.prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { users: true, rolePermissions: true } },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        isSystem: row.isSystem,
        userCount: row._count.users,
        permissionCount: row._count.rolePermissions,
      })),
    };
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) {
      throw notFound();
    }
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.rolePermissions
        .map((row) => ({
          id: row.permission.id,
          code: row.permission.code,
          module: row.permission.module,
          description: row.permission.description,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  async setPermissions(actor: AuthUser, roleId: string, dto: SetRolePermissionsDto, meta: RequestMeta) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) {
      throw notFound();
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });
    if (permissions.length !== dto.permissionIds.length) {
      throw new ApiException(ROLES_ERROR.NOT_FOUND, "Permission introuvable.", HttpStatus.BAD_REQUEST);
    }

    if (role.code === "SUPER_ADMIN") {
      const hasRolesManage = permissions.some((row) => row.code === PROTECTED_SUPER_ADMIN_PERMISSION);
      if (!hasRolesManage) {
        throw new ApiException(
          ROLES_ERROR.SUPER_ADMIN_GUARD,
          "Le rôle super administrateur doit conserver la permission de gestion des rôles.",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const previousCodes = role.rolePermissions.map((row) => row.permission.code).sort();
    const nextCodes = permissions.map((row) => row.code).sort();

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (dto.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.ROLE_PERMISSIONS_UPDATED,
          entityType: AUDIT_ENTITY.ROLE,
          entityId: roleId,
          oldValue: { role: role.code, permissions: previousCodes },
          newValue: { role: role.code, permissions: nextCodes },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(roleId);
  }
}

function notFound(): ApiException {
  return new ApiException(ROLES_ERROR.NOT_FOUND, "Rôle introuvable.", HttpStatus.NOT_FOUND);
}