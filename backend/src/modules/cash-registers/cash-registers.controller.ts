import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CashRegistersService } from "./cash-registers.service";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { ListCashRegistersQueryDto } from "./dto/list-cash-registers.query.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

@Controller("cash-registers")
@RequirePermission("stores.manage")
export class CashRegistersController {
  constructor(private readonly cashRegisters: CashRegistersService) {}

  @Get()
  list(@Query() query: ListCashRegistersQueryDto) {
    return this.cashRegisters.list(query);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateCashRegisterDto) {
    return this.cashRegisters.create(actor, dto, meta);
  }

  @Patch(":id")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCashRegisterDto,
  ) {
    return this.cashRegisters.update(actor, id, dto, meta);
  }
}
