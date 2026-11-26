import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { LiveSyncGateway } from "./live-sync.gateway";
import { LiveSyncInterceptor } from "./live-sync.interceptor";
import { LiveSyncService } from "./live-sync.service";

@Module({
  imports: [AuthModule],
  providers: [
    LiveSyncService,
    LiveSyncGateway,
    {
      provide: APP_INTERCEPTOR,
      useClass: LiveSyncInterceptor,
    },
  ],
  exports: [LiveSyncService],
})
export class LiveSyncModule {}