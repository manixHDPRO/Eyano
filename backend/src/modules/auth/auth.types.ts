import type { AuthUser } from "../../common/types/auth-user";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: string;
};

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

export type SecuritySettings = {
  accessTtlMinutes: number;
  refreshTtlHours: number;
  maxFailedLogins: number;
  lockMinutes: number;
};

export type AuthSession = {
  accessToken: string;
  expiresIn: number;
  refreshRaw: string;
  refreshMaxAgeMs: number;
  user: AuthUser;
};
