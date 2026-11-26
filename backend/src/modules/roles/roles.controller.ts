import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";
import { RolesService } from "./roles.service";

@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission("users.manage")
  list() {
    return this.roles.list();
  }

  @Get(":id")
  @RequirePermission("roles.manage")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.roles.findOne(id);
  }

  @Patch(":id/permissions")
  @RequirePermission("roles.manage")
  setPermissions(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.roles.setPermissions(actor, id, dto, meta);
  }
}