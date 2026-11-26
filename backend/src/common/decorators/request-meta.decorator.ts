import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { readRequestMeta, type RequestMeta } from "../http/request-meta";

export const CurrentRequestMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return readRequestMeta(request);
});
