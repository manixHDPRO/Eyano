import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CreateStoreDto } from "./dto/create-store.dto";
import { DeleteStoresDto } from "./dto/delete-stores.dto";
import { ListStoresQueryDto } from "./dto/list-stores.query.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";
import { StoresService } from "./stores.service";

@Controller("stores")
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get("options")
  @RequirePermission("users.manage")
  options() {
    return this.stores.listForAssignment();
  }

  @Get()
  @RequirePermission("stores.manage")
  list(@Query() query: ListStoresQueryDto) {
    return this.stores.list(query);
  }

  @Post("bulk-delete")
  @RequirePermission("stores.delete")
  bulkDelete(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: DeleteStoresDto,
  ) {
    return this.stores.removeMany(actor, dto, meta);
  }

  @Get(":id")
  @RequirePermission("stores.manage")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.stores.findOne(id);
  }

  @Post()
  @RequirePermission("stores.manage")
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateStoreDto) {
    return this.stores.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("stores.manage")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.stores.update(actor, id, dto, meta);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("stores.delete")
  remove(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.stores.remove(actor, id, meta);
  }
}
