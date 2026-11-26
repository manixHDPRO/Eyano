import { Controller, Get, Query } from "@nestjs/common";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import { ListPaymentsQueryDto } from "./dto/list-payments.query.dto";
import { PaymentsListService } from "./payments-list.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsList: PaymentsListService) {}

  @Get("summary")
  @RequirePermission(["reports.read", "sales.void", "sales.create"])
  summary(@CurrentUser() actor: AuthUser, @Query("storeId") storeId?: string) {
    return this.paymentsList.summary(actor, storeId);
  }

  @Get()
  @RequirePermission(["reports.read", "sales.void", "sales.create"])
  @StoreScoped("query", "storeId")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListPaymentsQueryDto) {
    return this.paymentsList.list(actor, query);
  }
}