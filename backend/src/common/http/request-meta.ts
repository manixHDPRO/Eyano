import type { Request } from "express";

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

export function readRequestMeta(request: Request): RequestMeta {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  return {
    ip: forwardedIp || request.ip || null,
    userAgent: request.headers["user-agent"] ?? null,
  };
}
