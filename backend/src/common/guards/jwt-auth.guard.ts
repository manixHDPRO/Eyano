import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserStatus } from "@prisma/client";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ApiException } from "../exceptions/api.exception";
import type { AuthenticatedRequest } from "../types/authenticated-request";
import { mapAuthUser } from "../mappers/auth-user.mapper";
import { AccessService } from "../access/access.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AUTH_ERROR } from "../../modules/auth/auth.constants";
import { JwtTokenService } from "../../modules/auth/jwt-token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtTokenService,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED);
    }

    let payload: ReturnType<JwtTokenService["verify"]>;
    try {
      payload = this.jwt.verify(token);
    } catch (error) {
      if (isExpiredTokenError(error)) {
        throw new ApiException(AUTH_ERROR.TOKEN_EXPIRED, "Jeton d'accès expiré.", HttpStatus.UNAUTHORIZED);
      }
      throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED);
    }

    if (!payload.sub) {
      throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user) {
      throw new ApiException(AUTH_ERROR.UNAUTHORIZED, "Authentification requise.", HttpStatus.UNAUTHORIZED);
    }

    switch (user.status) {
      case UserStatus.ACTIVE:
        if (user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now()) {
          throw new ApiException(
            AUTH_ERROR.ACCOUNT_LOCKED,
            "Compte temporairement verrouillé. Réessayez plus tard.",
            HttpStatus.FORBIDDEN,
          );
        }
        break;
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

    const accessContext = await this.access.loadContext(user.id);
    request.access = accessContext;
    request.user = mapAuthUser(user, accessContext);
    return true;
  }
}

function extractBearer(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return undefined;
  }
  return token;
}

function isExpiredTokenError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "TokenExpiredError";
}

