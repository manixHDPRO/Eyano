import type { AccessContext } from "../types/access-context";
import type { AuthUser } from "../types/auth-user";

type UserRoleSlice = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  role: { id: string; code: string; name: string };
};

export function mapAuthUser(user: UserRoleSlice, access: AccessContext): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    role: {
      id: user.role.id,
      code: user.role.code,
      name: user.role.name,
    },
    permissions: access.permissions,
    stores: access.stores,
  };
}