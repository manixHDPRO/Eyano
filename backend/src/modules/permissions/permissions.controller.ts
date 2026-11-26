import { Controller, Get } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { PermissionsService } from "./permissions.service";

@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @RequirePermission("roles.manage")
  list() {
    return this.permissions.listCatalog();
  }
}