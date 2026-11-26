import { HttpStatus, Injectable } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { USERS_ERROR } from "./users.constants";

@Injectable()
export class UsersPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  assertActorCanManageTarget(actor: AuthUser, targetRoleCode: string): void {
    if (targetRoleCode === "SUPER_ADMIN" && actor.role.code !== "SUPER_ADMIN") {
      throw new ApiException(
        USERS_ERROR.CANNOT_MANAGE_SUPER_ADMIN,
        "Vous ne pouvez pas gérer un super administrateur.",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  assertRoleAssignable(actor: AuthUser, roleCode: string): void {
    if (roleCode === "SUPER_ADMIN" && actor.role.code !== "SUPER_ADMIN") {
      throw new ApiException(
        USERS_ERROR.CANNOT_ASSIGN_SUPER_ADMIN,
        "Seul un super administrateur peut attribuer ce rôle.",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  assertNotSelf(actorId: string, targetId: string, action: "deactivate"): void {
    if (actorId === targetId && action === "deactivate") {
      throw new ApiException(
        USERS_ERROR.SELF_DEACTIVATE,
        "Vous ne pouvez pas désactiver votre propre compte.",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async assertSuperAdminSurvival(excludedUserId?: string, nextRoleCode?: string): Promise<void> {
    const superRole = await this.prisma.role.findUnique({ where: { code: "SUPER_ADMIN" } });
    if (!superRole) {
      return;
    }

    const activeSuperAdmins = await this.prisma.user.count({
      where: {
        status: UserStatus.ACTIVE,
        roleId: superRole.id,
        ...(excludedUserId ? { NOT: { id: excludedUserId } } : {}),
      },
    });

    if (nextRoleCode && nextRoleCode !== "SUPER_ADMIN" && excludedUserId) {
      const target = await this.prisma.user.findUnique({
        where: { id: excludedUserId },
        include: { role: true },
      });
      if (target?.role.code === "SUPER_ADMIN" && activeSuperAdmins < 1) {
        throw lastSuperAdminError();
      }
      return;
    }

    if (activeSuperAdmins < 1) {
      throw lastSuperAdminError();
    }
  }

  async assertCanDeactivate(actor: AuthUser, targetId: string, targetRoleCode: string): Promise<void> {
    this.assertActorCanManageTarget(actor, targetRoleCode);
    this.assertNotSelf(actor.id, targetId, "deactivate");
    if (targetRoleCode === "SUPER_ADMIN") {
      const superRole = await this.prisma.role.findUnique({ where: { code: "SUPER_ADMIN" } });
      if (!superRole) {
        return;
      }
      const others = await this.prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          roleId: superRole.id,
          NOT: { id: targetId },
        },
      });
      if (others < 1) {
        throw lastSuperAdminError();
      }
    }
  }
}

function lastSuperAdminError(): ApiException {
  return new ApiException(
    USERS_ERROR.LAST_SUPER_ADMIN,
    "Il doit rester au moins un super administrateur actif.",
    HttpStatus.FORBIDDEN,
  );
}