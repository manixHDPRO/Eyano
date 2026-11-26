import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CancelInternalIssueDto } from "./dto/cancel-internal-issue.dto";
import { CreateInternalIssueDto } from "./dto/create-internal-issue.dto";
import { InternalIssueCatalogQueryDto } from "./dto/internal-issue-catalog.query.dto";
import { ListInternalIssuesQueryDto } from "./dto/list-internal-issues.query.dto";
import { RejectInternalIssueDto } from "./dto/reject-internal-issue.dto";
import { ReviewInternalIssueDto } from "./dto/review-internal-issue.dto";
import { UpdateInternalIssueDto } from "./dto/update-internal-issue.dto";
import { INTERNAL_ISSUE_READ_PERMISSIONS } from "./internal-issues.constants";
import { InternalIssuesService } from "./internal-issues.service";

@Controller("internal-issues")
export class InternalIssuesController {
  constructor(private readonly internalIssues: InternalIssuesService) {}

  @Get("summary")
  @RequirePermission(INTERNAL_ISSUE_READ_PERMISSIONS)
  summary(@CurrentUser() actor: AuthUser) {
    return this.internalIssues.summary(actor);
  }

  @Get("locations")
  @RequirePermission(INTERNAL_ISSUE_READ_PERMISSIONS)
  locations(@CurrentUser() actor: AuthUser) {
    return this.internalIssues.locations(actor);
  }

  @Get("catalog")
  @RequirePermission(INTERNAL_ISSUE_READ_PERMISSIONS)
  catalog(@CurrentUser() actor: AuthUser, @Query() query: InternalIssueCatalogQueryDto) {
    return this.internalIssues.catalog(actor, query);
  }

  @Get()
  @RequirePermission(INTERNAL_ISSUE_READ_PERMISSIONS)
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListInternalIssuesQueryDto) {
    return this.internalIssues.list(actor, query);
  }

  @Get("pending-store-confirmation")
  @RequirePermission("stock.read")
  @StoreScoped("query", "storeId")
  listPendingStoreConfirmation(@CurrentUser() actor: AuthUser, @Query("storeId") storeId: string) {
    return this.internalIssues.listPendingStoreConfirmation(actor, storeId);
  }

  @Get(":id")
  @RequirePermission(INTERNAL_ISSUE_READ_PERMISSIONS)
  findOne(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.internalIssues.findOne(actor, id);
  }

  @Post()
  @RequirePermission("internal_issues.request")
  create(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: CreateInternalIssueDto,
  ) {
    return this.internalIssues.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("internal_issues.request")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInternalIssueDto,
  ) {
    return this.internalIssues.update(actor, id, dto, meta);
  }

  @Post(":id/submit")
  @HttpCode(200)
  @RequirePermission("internal_issues.request")
  submit(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.internalIssues.submit(actor, id, meta);
  }

  @Post(":id/confirm-store")
  @HttpCode(200)
  @RequirePermission("stock.read")
  confirmStore(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.internalIssues.confirmStore(actor, id, meta);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequirePermission("internal_issues.validate")
  approve(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewInternalIssueDto,
  ) {
    return this.internalIssues.approve(actor, id, dto, meta);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @RequirePermission("internal_issues.validate")
  reject(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectInternalIssueDto,
  ) {
    return this.internalIssues.reject(actor, id, dto, meta);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @RequirePermission(INTERNAL_ISSUE_READ_PERMISSIONS)
  cancel(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelInternalIssueDto,
  ) {
    return this.internalIssues.cancel(actor, id, dto, meta);
  }
}