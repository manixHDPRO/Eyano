export const GLOBAL_SCOPE_ROLE_CODES = ["SUPER_ADMIN", "CENTRAL_ADMIN"] as const;

export type GlobalScopeRoleCode = (typeof GLOBAL_SCOPE_ROLE_CODES)[number];

export const ACCESS_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  STORE_SCOPE_DENIED: "STORE_SCOPE_DENIED",
  USER_POLICY: "USER_POLICY",
  ROLE_POLICY: "ROLE_POLICY",
} as const;

export const PROTECTED_SUPER_ADMIN_PERMISSION = "roles.manage";