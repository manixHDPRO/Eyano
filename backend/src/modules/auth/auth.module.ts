import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordService } from "./password.service";
import { RefreshCookieService } from "./refresh-cookie.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtTokenService,
    PasswordService,
    RefreshCookieService,
  ],
  exports: [AuthService, JwtTokenService],
})
export class AuthModule {}
