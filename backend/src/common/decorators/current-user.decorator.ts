import { createParamDecorator, ExecutionContext, HttpStatus } from "@nestjs/common";
import { ApiException } from "../exceptions/api.exception";
import type { AuthUser } from "../types/auth-user";
import type { AuthenticatedRequest } from "../types/authenticated-request";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    throw new ApiException("UNAUTHORIZED", "Authentification requise.", HttpStatus.UNAUTHORIZED);
  }
  return request.user;
});
