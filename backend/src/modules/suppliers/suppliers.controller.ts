import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { ListSuppliersQueryDto } from "./dto/list-suppliers.query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermission(["suppliers.manage", "suppliers.read"])
  list(@Query() query: ListSuppliersQueryDto) {
    return this.suppliers.list(query);
  }

  @Get("options")
  @RequirePermission(["suppliers.manage", "receipts.validate"])
  options() {
    return this.suppliers.options();
  }

  @Get(":id")
  @RequirePermission(["suppliers.manage", "suppliers.read"])
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.suppliers.findOne(id);
  }

  @Post()
  @RequirePermission("suppliers.manage")
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("suppliers.manage")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(actor, id, dto, meta);
  }
}