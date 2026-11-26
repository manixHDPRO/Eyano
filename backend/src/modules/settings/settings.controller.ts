import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SettingsService } from "./settings.service";

const SETTINGS_READ_PERMISSIONS = ["settings.update", "settings.update_critical"] as const;

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermission(SETTINGS_READ_PERMISSIONS)
  list() {
    return this.settings.list();
  }

  @Patch()
  @RequirePermission(SETTINGS_READ_PERMISSIONS)
  update(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(actor, dto, meta);
  }
}