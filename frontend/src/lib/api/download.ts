import { getAccessToken, clearAccessToken, setAccessToken } from "../auth/session-store";
import { ApiError, isApiErrorBody } from "./errors";
import type { AuthResponse } from "./types";

const API_PREFIX = "/api/v1";

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

function parseFilename(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) {
    return undefined;
  }
  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  return match?.[1];
}

export async function apiDownload(path: string, init?: RequestInit): Promise<{ blob: Blob; filename?: string }> {
  const execute = async (token: string | null): Promise<Response> => {
    const headers = new Headers(init?.headers);
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
  if (response.status === 401) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      response = await execute(nextToken);
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (isApiErrorBody(payload)) {
      throw new ApiError(response.status, payload);
    }
    throw new ApiError(response.status, {
      code: "HTTP_ERROR",
      message: response.statusText || "Erreur réseau",
      details: payload,
    });
  }

  const mimeType = (response.headers.get("Content-Type") ?? "application/octet-stream").split(";")[0]?.trim();
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 5) {
    throw new ApiError(502, {
      code: "DOWNLOAD_EMPTY",
      message: "Le fichier exporté est vide.",
    });
  }
  const header = new TextDecoder().decode(buffer.slice(0, 5));
  if (pathLooksLikePdf(path) && header !== "%PDF-") {
    throw new ApiError(502, {
      code: "DOWNLOAD_INVALID_PDF",
      message: "La réponse du serveur n'est pas un PDF valide.",
    });
  }
  if (path.toLowerCase().includes(".xlsx")) {
    const head2 = new TextDecoder().decode(buffer.slice(0, 2));
    if (head2 !== "PK") {
      throw new ApiError(502, {
        code: "DOWNLOAD_INVALID_XLSX",
        message: "La réponse du serveur n'est pas un fichier Excel valide.",
      });
    }
  }
  const blob = new Blob([buffer], { type: mimeType });
  const filename = parseFilename(response.headers.get("Content-Disposition"));
  return { blob, filename };
}

function pathLooksLikePdf(path: string): boolean {
  return path.toLowerCase().includes(".pdf");
}

export function triggerBrowserDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}