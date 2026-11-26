import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermission(["products.manage", "products.read"])
  tree() {
    return this.categories.tree();
  }

  @Get("leaves")
  @RequirePermission(["products.manage", "products.read"])
  leaves() {
    return this.categories.listLeaves();
  }

  @Get(":id")
  @RequirePermission(["products.manage", "products.read"])
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @RequirePermission("products.manage")
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateCategoryDto) {
    return this.categories.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("products.manage")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(actor, id, dto, meta);
  }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("products.manage")
  archive(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Param("id", ParseUUIDPipe) id: string) {
    return this.categories.archive(actor, id, meta);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("products.manage")
  restore(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Param("id", ParseUUIDPipe) id: string) {
    return this.categories.restore(actor, id, meta);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("products.manage")
  remove(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Param("id", ParseUUIDPipe) id: string) {
    return this.categories.remove(actor, id, meta);
  }
}
