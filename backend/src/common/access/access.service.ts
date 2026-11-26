import { Injectable } from "@nestjs/common";
import { GLOBAL_SCOPE_ROLE_CODES } from "./access.constants";
import type { AccessContext, UserStoreAssignment } from "../types/access-context";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async loadContext(userId: string): Promise<AccessContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        storeMemberships: {
          include: { store: true },
          orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
        },
      },
    });
    if (!user) {
      return emptyContext();
    }

    const permissions = user.role.rolePermissions.map((row) => row.permission.code).sort();
    const stores: UserStoreAssignment[] = user.storeMemberships.map((row) => ({
      id: row.store.id,
      code: row.store.code,
      name: row.store.name,
      isPrimary: row.isPrimary,
    }));
    const storeIds = stores.map((store) => store.id);
    const isGlobalScope = isGlobalRole(user.role.code);

    return {
      roleCode: user.role.code,
      permissions,
      storeIds,
      stores,
      isGlobalScope,
    };
  }

  hasPermission(context: AccessContext, code: string): boolean {
    return context.permissions.includes(code);
  }

  canAccessStore(context: AccessContext, storeId: string | undefined): boolean {
    if (!storeId) {
      return false;
    }
    if (context.isGlobalScope) {
      return true;
    }
    return context.storeIds.includes(storeId);
  }

  isGlobalRole(roleCode: string): boolean {
    return isGlobalRole(roleCode);
  }
}

function isGlobalRole(roleCode: string): boolean {
  return (GLOBAL_SCOPE_ROLE_CODES as readonly string[]).includes(roleCode);
}

function emptyContext(): AccessContext {
  return {
    roleCode: "",
    permissions: [],
    storeIds: [],
    stores: [],
    isGlobalScope: false,
  };
}