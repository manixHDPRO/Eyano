import { clearAccessToken, setAccessToken } from "../auth/session-store";
import { apiRequest } from "./client";
import type { AuthResponse, AuthUser, MeResponse } from "./types";

export async function login(email: string, password: string): Promise<AuthResponse> {
  const session = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuthRefresh: true,
  });
  setAccessToken(session.accessToken);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  } finally {
    clearAccessToken();
  }
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const payload = await apiRequest<MeResponse>("/auth/me");
  return payload.user;
}

export function homePathForRole(roleCode: string): string {
  return roleCode === "CASHIER" ? "/pos" : "/admin";
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
