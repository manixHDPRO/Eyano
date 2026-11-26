import type { LoginHistory, User } from "@prisma/client";

type UserSummary = Pick<User, "id" | "email" | "firstName" | "lastName"> & {
  role: { code: string; name: string };
};

type Row = LoginHistory & {
  user: UserSummary | null;
};

export type LoginHistoryItemDto = {
  id: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleCode: string;
    roleName: string;
  } | null;
};

export function toLoginHistoryItem(row: Row): LoginHistoryItemDto {
  return {
    id: row.id,
    success: row.success,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          roleCode: row.user.role.code,
          roleName: row.user.role.name,
        }
      : null,
  };
}