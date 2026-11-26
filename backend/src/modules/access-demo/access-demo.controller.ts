import { Controller, Get, Query } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { StoreScoped } from "../../common/decorators/store-scoped.decorator";

/** Endpoint de preuve palier 5 : permission + périmètre boutique. */
@Controller("access-demo")
export class AccessDemoController {
  @Get("store-scope")
  @RequirePermission("stock.read")
  @StoreScoped("query", "storeId")
  storeScope(@Query("storeId") storeId: string) {
    return { storeId, scoped: true };
  }
}