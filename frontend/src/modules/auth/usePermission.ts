import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "./AuthProvider";

export function usePermission(code: string): boolean {
  const { user } = useAuth();
  return hasPermission(user, code);
}