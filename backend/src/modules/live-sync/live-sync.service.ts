import { Injectable, Logger } from "@nestjs/common";
import type { Server } from "socket.io";
import type { LiveSyncInvalidatePayload, LiveSyncQueryRoot } from "./live-sync.types";
import { LIVE_SYNC_EVENT } from "./live-sync.types";

@Injectable()
export class LiveSyncService {
  private readonly logger = new Logger(LiveSyncService.name);
  private server: Server | null = null;

  attachServer(server: Server): void {
    this.server = server;
  }

  broadcastInvalidation(keys: LiveSyncQueryRoot[]): void {
    if (!this.server || keys.length === 0) {
      return;
    }
    const payload: LiveSyncInvalidatePayload = {
      keys,
      at: new Date().toISOString(),
    };
    this.server.emit(LIVE_SYNC_EVENT, payload);
    this.logger.debug(`live-sync invalidate (${keys.join(", ")})`);
  }
}