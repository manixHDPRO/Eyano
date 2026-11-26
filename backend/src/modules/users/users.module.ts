import { Module } from "@nestjs/common";
import { PasswordService } from "../auth/password.service";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { UsersController } from "./users.controller";
import { UsersPolicyService } from "./users-policy.service";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersPolicyService, PasswordService],
  exports: [UsersService],
})
export class UsersModule {}