import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CashSessionsService } from "./cash-sessions.service";
import { CurrentCashSessionQueryDto } from "./dto/current-cash-session.query.dto";
import { ListCashSessionsQueryDto } from "./dto/list-cash-sessions.query.dto";
import { CloseCashSessionDto } from "./dto/close-cash-session.dto";
import { OpenCashSessionDto } from "./dto/open-cash-session.dto";

@Controller("cash-sessions")
export class CashSessionsController {
  constructor(private readonly sessions: CashSessionsService) {}

  @Get()
  @RequirePermission(["cash.session", "reports.read"])
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListCashSessionsQueryDto) {
    return this.sessions.list(actor, query);
  }

  @Get("current")
  @RequirePermission(["cash.session", "sales.create"])
  current(@CurrentUser() actor: AuthUser, @Query() query: CurrentCashSessionQueryDto) {
    return this.sessions.current(actor, query);
  }

  @Get(":id")
  @RequirePermission(["cash.session", "reports.read"])
  getById(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.sessions.getById(actor, id);
  }

  @Post("open")
  @RequirePermission("cash.session")
  open(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: OpenCashSessionDto) {
    return this.sessions.open(actor, dto, meta);
  }

  @Post(":id/close")
  @HttpCode(200)
  @RequirePermission("cash.session")
  close(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.sessions.close(actor, id, dto, meta);
  }
}