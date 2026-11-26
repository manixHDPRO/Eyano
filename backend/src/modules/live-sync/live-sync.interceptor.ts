import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import { queryKeysForMutationPath } from "./live-sync-path-rules";
import { LiveSyncService } from "./live-sync.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class LiveSyncInterceptor implements NestInterceptor {
  constructor(private readonly liveSync: LiveSyncService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }
    const path = request.originalUrl ?? request.url;
    const keys = queryKeysForMutationPath(path);
    if (!keys?.length) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.liveSync.broadcastInvalidation(keys);
        },
      }),
    );
  }
}