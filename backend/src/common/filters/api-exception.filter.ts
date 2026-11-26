import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { ApiErrorBody } from "../types/api-error-body";

function isMulterLimitError(exception: unknown): boolean {
  return (
    typeof exception === "object" &&
    exception !== null &&
    "name" in exception &&
    (exception as { name: string }).name === "MulterError" &&
    "code" in exception &&
    (exception as { code: string }).code === "LIMIT_FILE_SIZE"
  );
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.code === "string" && typeof record.message === "string";
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = {
      code: "INTERNAL_ERROR",
      message: "Une erreur inattendue est survenue.",
    };

    if (isMulterLimitError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      body = {
        code: "PRODUCT_PHOTO_TOO_LARGE",
        message: "L’image dépasse 2 Mo.",
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();

      if (isApiErrorBody(payload)) {
        body = {
          code: payload.code,
          message: payload.message,
          ...(payload.details !== undefined ? { details: payload.details } : {}),
        };
      } else if (typeof payload === "string") {
        body = {
          code: HttpStatus[status] ?? "HTTP_ERROR",
          message: payload,
        };
      } else if (typeof payload === "object" && payload !== null) {
        const record = payload as Record<string, unknown>;
        const message = Array.isArray(record.message)
          ? record.message.join(", ")
          : String(record.message ?? record.error ?? "Erreur HTTP");
        body = {
          code: HttpStatus[status] ?? "HTTP_ERROR",
          message,
          details: record,
        };
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json(body);
  }
}