import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ListExpensesQueryDto } from "./dto/list-expenses.query.dto";
import { PendingCashierExpensesQueryDto } from "./dto/pending-cashier-expenses.query.dto";
import { EXPENSE_READ_PERMISSIONS, EXPENSE_RECEIPT_MAX_BYTES } from "./expenses.constants";
import { ExpensesService } from "./expenses.service";

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get("categories")
  @RequirePermission(EXPENSE_READ_PERMISSIONS)
  categories() {
    return this.expenses.categories();
  }

  @Get("locations")
  @RequirePermission("expenses.manage")
  locations(@CurrentUser() actor: AuthUser) {
    return this.expenses.locations(actor);
  }

  @Get("summary")
  @RequirePermission(EXPENSE_READ_PERMISSIONS)
  @StoreScoped("query", "storeId")
  summary(@CurrentUser() actor: AuthUser, @Query("storeId") storeId?: string) {
    return this.expenses.summary(actor, storeId);
  }

  @Get()
  @RequirePermission(EXPENSE_READ_PERMISSIONS)
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListExpensesQueryDto) {
    return this.expenses.list(actor, query);
  }

  @Get("pending-cashier-confirmation")
  @RequirePermission("cash.session")
  @StoreScoped("query", "storeId")
  listPendingCashierConfirmation(
    @CurrentUser() actor: AuthUser,
    @Query() query: PendingCashierExpensesQueryDto,
  ) {
    return this.expenses.listPendingCashierConfirmation(actor, query.storeId, query.cashRegisterId);
  }

  @Get(":id")
  @RequirePermission(EXPENSE_READ_PERMISSIONS)
  findOne(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.expenses.findOne(actor, id);
  }

  @Post(":id/confirm-cashier")
  @HttpCode(200)
  @RequirePermission("cash.session")
  confirmCashier(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.expenses.confirmCashier(actor, id, meta);
  }

  @Post()
  @RequirePermission("expenses.manage")
  create(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenses.create(actor, dto, meta);
  }

  @Post(":id/receipt")
  @RequirePermission("expenses.manage")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: EXPENSE_RECEIPT_MAX_BYTES },
    }),
  )
  attachReceipt(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.expenses.attachReceipt(actor, id, file, meta);
  }
}