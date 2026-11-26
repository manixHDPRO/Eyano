import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSION_KEY = "eyano:require_permission";

export type RequiredPermissionMeta = string | readonly string[];

export const RequirePermission = (permission: RequiredPermissionMeta) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);