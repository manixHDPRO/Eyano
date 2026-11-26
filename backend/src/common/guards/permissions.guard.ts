import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessService } from "../access/access.service";
import { ACCESS_ERROR } from "../access/access.constants";
import { REQUIRE_PERMISSION_KEY } from "../decorators/require-permission.decorator";
import { STORE_SCOPE_KEY, type StoreScopeMeta } from "../decorators/store-scoped.decorator";
import { ApiException } from "../exceptions/api.exception";
import type { AuthenticatedRequest } from "../types/authenticated-request";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string | readonly string[] | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const storeScope = this.reflector.getAllAndOverride<StoreScopeMeta | undefined>(STORE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission && !storeScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ApiException(ACCESS_ERROR.FORBIDDEN, "Action non autorisée.", HttpStatus.FORBIDDEN);
    }

    const accessContext = request.access ?? (await this.access.loadContext(request.user.id));
    request.access = accessContext;

    if (requiredPermission) {
      const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
      const allowed = required.some((code) => this.access.hasPermission(accessContext, code));
      if (!allowed) {
        throw new ApiException(
          ACCESS_ERROR.FORBIDDEN,
          "Vous n'avez pas la permission requise pour cette action.",
          HttpStatus.FORBIDDEN,
          { permission: required.length === 1 ? required[0] : required },
        );
      }
    }

    if (storeScope) {
      const storeId = readStoreId(request, storeScope);
      if (storeId && !this.access.canAccessStore(accessContext, storeId)) {
        throw new ApiException(
          ACCESS_ERROR.STORE_SCOPE_DENIED,
          "Cette boutique ne fait pas partie de votre périmètre.",
          HttpStatus.FORBIDDEN,
          { storeId },
        );
      }
    }

    return true;
  }
}

function readStoreId(request: AuthenticatedRequest, meta: StoreScopeMeta): string | undefined {
  switch (meta.source) {
    case "query": {
      const raw = request.query[meta.key];
      return typeof raw === "string" ? raw : undefined;
    }
    case "param": {
      const raw = request.params[meta.key];
      return typeof raw === "string" ? raw : undefined;
    }
    case "body": {
      const body = request.body as Record<string, unknown> | undefined;
      const raw = body?.[meta.key];
      return typeof raw === "string" ? raw : undefined;
    }
    default: {
      const unexpected: never = meta.source;
      return unexpected;
    }
  }
}