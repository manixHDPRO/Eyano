import type { AuthUser } from "../api/types";

export function hasPermission(user: AuthUser | null | undefined, code: string): boolean {
  if (!user) {
    return false;
  }
  return user.permissions.includes(code);
}