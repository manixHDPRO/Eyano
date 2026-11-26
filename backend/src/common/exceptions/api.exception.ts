import { HttpException, HttpStatus } from "@nestjs/common";
import type { ApiErrorBody } from "../types/api-error-body";

export class ApiException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    details?: unknown,
  ) {
    const body: ApiErrorBody = { code, message, details };
    super(body, status);
  }
}