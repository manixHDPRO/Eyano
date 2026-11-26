import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.status = status;
    this.details = body.details;
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.code === "string" && typeof record.message === "string";
}

type ValidationErrorDetail = {
  field?: string;
  message?: string;
};

function firstValidationDetailMessage(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) {
    return null;
  }
  const first = details[0] as ValidationErrorDetail;
  return typeof first.message === "string" && first.message.length > 0 ? first.message : null;
}

/** Message utilisateur : détail de validation si disponible, sinon message API. */
export function formatApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  if (error.code === "VALIDATION_ERROR") {
    const detail = firstValidationDetailMessage(error.details);
    if (detail) {
      return detail;
    }
  }
  return error.message || fallback;
}