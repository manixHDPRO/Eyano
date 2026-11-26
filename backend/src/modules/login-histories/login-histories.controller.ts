import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import { ListLoginHistoriesQueryDto } from "./dto/list-login-histories.query.dto";
import { LoginHistoriesService } from "./login-histories.service";

@Controller("login-histories")
export class LoginHistoriesController {
  constructor(private readonly loginHistories: LoginHistoriesService) {}

  @Get("summary")
  @RequirePermission("audit.read")
  summary(@CurrentUser() actor: AuthUser) {
    return this.loginHistories.summary(actor);
  }

  @Get()
  @RequirePermission("audit.read")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListLoginHistoriesQueryDto) {
    return this.loginHistories.list(actor, query);
  }
}