import type { UserStoreAssignment } from "./access-context";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  role: {
    id: string;
    code: string;
    name: string;
  };
  permissions: string[];
  stores: UserStoreAssignment[];
};
