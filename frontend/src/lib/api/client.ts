import { clearAccessToken, getAccessToken, setAccessToken } from "../auth/session-store";
import { ApiError, isApiErrorBody } from "./errors";
import type { AuthResponse } from "./types";

const API_PREFIX = "/api/v1";

type RequestOptions = RequestInit & {
  parseJson?: boolean;
  skipAuthRefresh?: boolean;
};

function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return "";
}

function buildUrl(path: string): string {
  const base = resolveBaseUrl();
  return `${base}${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      clearAccessToken();
      return null;
    }
    const payload = (await response.json()) as AuthResponse;
    setAccessToken(payload.accessToken);
    return payload.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const execute = async (token: string | null): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (!headers.has("Content-Type") && init?.body !== undefined && !isFormData) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(buildUrl(path), {
      ...init,
      headers,
      credentials: "include",
    });
  };

  let response = await execute(getAccessToken());
  const skipRefresh = init?.skipAuthRefresh === true;

  if (response.status === 401 && !skipRefresh) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      response = await execute(nextToken);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const parseJson = init?.parseJson !== false;
  const payload = parseJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError(response.status, payload);
    }
    throw new ApiError(response.status, {
      code: "HTTP_ERROR",
      message: response.statusText || "Erreur réseau",
      details: payload,
    });
  }

  return payload as T;
}

export function restoreSession(): Promise<string | null> {
  return refreshAccessToken();
}
