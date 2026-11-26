import { createHash, randomBytes, randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, UserStatus } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { AuthUser } from "../../common/types/auth-user";
import { jsonToNumber } from "../../common/utils/json-number";
import { PrismaService } from "../../prisma/prisma.service";
import { AUTH_ERROR, AUTH_SETTING_KEYS } from "./auth.constants";
import type { AccessTokenPayload, AuthSession, RequestMeta, SecuritySettings } from "./auth.types";
import { AccessService } from "../../common/access/access.service";
import { mapAuthUser } from "../../common/mappers/auth-user.mapper";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordService } from "./password.service";

type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

type RefreshOutcome =
  | { type: "session"; session: AuthSession }
  | { type: "reuse" }
  | { type: "invalid" }
  | { type: "unauthorized" };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtTokenService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
    private readonly audit: AuditLogsService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const settings = await this.loadSettings();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true },
    });

    if (!user) {
      await this.passwords.verifyDummy(password);
      await this.recordHistory(null, false, meta);
      throw this.invalidCredentials();
    }

    this.assertLoginAllowed(user);

    const passwordOk = await this.passwords.verify(password, user.passwordHash);
    if (!passwordOk) {
      await this.registerFailure(user, settings, meta);
      throw this.invalidCredentials();
    }

    await this.resetLockout(user.id, user.status);
    await this.recordHistory(user.id, true, meta);
    await this.audit.write({
      actorId: user.id,
      action: AUDIT_ACTION.LOGIN_SUCCESS,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      newValue: { email: user.email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.issueSession(user, meta, settings);
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<AuthSession> {
    if (!rawToken) {
      throw new ApiException(
        AUTH_ERROR.REFRESH_INVALID,
        "Session expirée. Veuillez vous reconnecter.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const settings = await this.loadSettings();
    const tokenHash = hashRefreshToken(rawToken);
    const now = new Date();

    const outcome = await this.prisma.$transaction(async (tx): Promise<RefreshOutcome> => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM refresh_tokens WHERE token_hash = ${tokenHash} FOR UPDATE
      `;
      const locked = rows[0];
      if (!locked) {
        return { type: "invalid" };
      }

      const current = await tx.refreshToken.findUnique({ where: { id: locked.id } });
      if (!current) {
        return { type: "invalid" };
      }

      if (current.revokedAt !== null) {
        await tx.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { type: "reuse" };
      }

      if (current.expiresAt <= now) {
        await tx.refreshToken.update({
          where: { id: current.id },
          data: { revokedAt: now },
        });
        return { type: "invalid" };
      }

      const user = await tx.user.findUnique({
        where: { id: current.userId },
        include: { role: true },
      });
      if (!user) {
        return { type: "unauthorized" };
      }
      this.assertActiveUser(user);

      const rotated = createRefreshTokenValue();
      const created = await tx.refreshToken.create({
        data: {
          userId: user.id,
          familyId: current.familyId,
          tokenHash: hashRefreshToken(rotated.raw),
          expiresAt: new Date(now.getTime() + settings.refreshTtlHours * 60 * 60 * 1000),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });

      await tx.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: now, replacedBy: created.id },
      });

      const accessContext = await this.access.loadContext(user.id);
      return { type: "session", session: this.toSession(user, accessContext, rotated.raw, settings) };
    });

    switch (outcome.type) {
      case "session":
        return outcome.session;
      case "reuse":
        throw new ApiException(
          AUTH_ERROR.REFRESH_REUSE,
          "Session invalidée. Veuillez vous reconnecter.",
          HttpStatus.UNAUTHORIZED,
        );
      case "invalid":
        throw new ApiException(
          AUTH_ERROR.REFRESH_INVALID,
          "Session expirée. Veuillez vous reconnecter.",
          HttpStatus.UNAUTHORIZED,
        );
      case "unauthorized":
        throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED);
      default: {
        const unexpected: never = outcome;
        throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED, {
          outcome: unexpected,
        });
      }
    }
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    const tokenHash = hashRefreshToken(rawToken);
    const now = new Date();
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED);
    }
    this.assertActiveUser(user);
    const accessContext = await this.access.loadContext(user.id);
    return mapAuthUser(user, accessContext);
  }

  private async issueSession(user: UserWithRole, meta: RequestMeta, settings: SecuritySettings): Promise<AuthSession> {
    const now = new Date();
    const refresh = createRefreshTokenValue();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: hashRefreshToken(refresh.raw),
        expiresAt: new Date(now.getTime() + settings.refreshTtlHours * 60 * 60 * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    const accessContext = await this.access.loadContext(user.id);
    return this.toSession(user, accessContext, refresh.raw, settings);
  }

  private toSession(
    user: UserWithRole,
    accessContext: Awaited<ReturnType<AccessService["loadContext"]>>,
    refreshRaw: string,
    settings: SecuritySettings,
  ): AuthSession {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.code,
    };
    const expiresIn = settings.accessTtlMinutes * 60;
    const accessToken = this.jwt.sign(payload, expiresIn);
    return {
      accessToken,
      expiresIn,
      refreshRaw,
      refreshMaxAgeMs: settings.refreshTtlHours * 60 * 60 * 1000,
      user: mapAuthUser(user, accessContext),
    };
  }

  private async loadSettings(): Promise<SecuritySettings> {
    const defaults = this.config.get<SecuritySettings>("auth.defaults") ?? {
      accessTtlMinutes: 15,
      refreshTtlHours: 12,
      maxFailedLogins: 5,
      lockMinutes: 15,
    };

    const rows = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: [
            AUTH_SETTING_KEYS.accessTtlMinutes,
            AUTH_SETTING_KEYS.refreshTtlHours,
            AUTH_SETTING_KEYS.maxFailedLogins,
            AUTH_SETTING_KEYS.lockMinutes,
          ],
        },
      },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    return {
      accessTtlMinutes: jsonToNumber(byKey.get(AUTH_SETTING_KEYS.accessTtlMinutes), defaults.accessTtlMinutes),
      refreshTtlHours: jsonToNumber(byKey.get(AUTH_SETTING_KEYS.refreshTtlHours), defaults.refreshTtlHours),
      maxFailedLogins: jsonToNumber(byKey.get(AUTH_SETTING_KEYS.maxFailedLogins), defaults.maxFailedLogins),
      lockMinutes: jsonToNumber(byKey.get(AUTH_SETTING_KEYS.lockMinutes), defaults.lockMinutes),
    };
  }

  private assertLoginAllowed(user: UserWithRole): void {
    const lockActive = isLockActive(user.lockedUntil);

    switch (user.status) {
      case UserStatus.INACTIVE:
        throw new ApiException(
          AUTH_ERROR.ACCOUNT_INACTIVE,
          "Ce compte est désactivé. Contactez un administrateur.",
          HttpStatus.FORBIDDEN,
        );
      case UserStatus.LOCKED:
        if (lockActive) {
          throw new ApiException(
            AUTH_ERROR.ACCOUNT_LOCKED,
            "Compte temporairement verrouillé. Réessayez plus tard.",
            HttpStatus.FORBIDDEN,
          );
        }
        return;
      case UserStatus.ACTIVE:
        if (lockActive) {
          throw new ApiException(
            AUTH_ERROR.ACCOUNT_LOCKED,
            "Compte temporairement verrouillé. Réessayez plus tard.",
            HttpStatus.FORBIDDEN,
          );
        }
        return;
      default: {
        const unexpected: never = user.status;
        throw new ApiException(
          AUTH_ERROR.ACCOUNT_INACTIVE,
          "Ce compte ne peut pas se connecter.",
          HttpStatus.FORBIDDEN,
          { status: unexpected },
        );
      }
    }
  }

  private assertActiveUser(user: UserWithRole): void {
    switch (user.status) {
      case UserStatus.ACTIVE:
        if (isLockActive(user.lockedUntil)) {
          throw new ApiException(
            AUTH_ERROR.ACCOUNT_LOCKED,
            "Compte temporairement verrouillé. Réessayez plus tard.",
            HttpStatus.FORBIDDEN,
          );
        }
        return;
      case UserStatus.LOCKED:
        throw new ApiException(
          AUTH_ERROR.ACCOUNT_LOCKED,
          "Compte temporairement verrouillé. Réessayez plus tard.",
          HttpStatus.FORBIDDEN,
        );
      case UserStatus.INACTIVE:
        throw new ApiException(
          AUTH_ERROR.ACCOUNT_INACTIVE,
          "Ce compte est désactivé. Contactez un administrateur.",
          HttpStatus.FORBIDDEN,
        );
      default: {
        const unexpected: never = user.status;
        throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED, {
          status: unexpected,
        });
      }
    }
  }

  private async registerFailure(user: UserWithRole, settings: SecuritySettings, meta: RequestMeta): Promise<void> {
    const nextCount = user.failedLoginCount + 1;
    const lockReached = nextCount >= settings.maxFailedLogins;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextCount,
        ...(lockReached
          ? {
              status: UserStatus.LOCKED,
              lockedUntil: new Date(Date.now() + settings.lockMinutes * 60 * 1000),
            }
          : {}),
      },
    });
    await this.recordHistory(user.id, false, meta);
  }

  private async resetLockout(userId: string, status: UserStatus): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        status: status === UserStatus.LOCKED ? UserStatus.ACTIVE : status,
      },
    });
  }

  private async recordHistory(userId: string | null, success: boolean, meta: RequestMeta): Promise<void> {
    await this.prisma.loginHistory.create({
      data: {
        userId,
        success,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  async changePassword(actor: AuthUser, currentPassword: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!user) {
      throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ApiException(AUTH_ERROR.ACCOUNT_INACTIVE, "Compte inactif.", HttpStatus.FORBIDDEN);
    }

    const currentOk = await this.passwords.verify(currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new ApiException(
        AUTH_ERROR.CURRENT_PASSWORD_INVALID,
        "Mot de passe actuel incorrect.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await this.audit.write({
      actorId: user.id,
      action: AUDIT_ACTION.USER_UPDATED,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      newValue: { passwordChanged: true },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  private invalidCredentials(): ApiException {
    return new ApiException(AUTH_ERROR.INVALID_CREDENTIALS, "E-mail ou mot de passe incorrect.", HttpStatus.UNAUTHORIZED);
  }
}

function isLockActive(lockedUntil: Date | null): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > Date.now();
}

function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function createRefreshTokenValue(): { raw: string } {
  return { raw: randomBytes(32).toString("base64url") };
}
