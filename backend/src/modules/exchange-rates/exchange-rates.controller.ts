import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ExchangeRateType } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { UpdateExchangeRateDto } from "./dto/update-exchange-rate.dto";
import { UpdateExchangeRatesPairDto } from "./dto/update-exchange-rates-pair.dto";
import { ExchangeRatesService } from "./exchange-rates.service";

@Controller("exchange-rates")
export class ExchangeRatesController {
  constructor(private readonly rates: ExchangeRatesService) {}

  @Get("current")
  @RequirePermission(["sales.create", "exchange_rates.update", "reports.read"])
  current() {
    return this.rates.current();
  }

  @Get("revisions")
  @RequirePermission(["exchange_rates.update", "reports.read"])
  revisions(@Query("take") take?: string) {
    const limit = take ? Math.min(100, Math.max(1, Number(take))) : 30;
    return this.rates.revisions(limit);
  }

  @Get("history/:rateType")
  @RequirePermission(["exchange_rates.update", "reports.read"])
  history(@Param("rateType") rateType: ExchangeRateType, @Query("take") take?: string) {
    const limit = take ? Math.min(100, Math.max(1, Number(take))) : 30;
    return this.rates.history(rateType, limit);
  }

  @Post("pair")
  @RequirePermission("exchange_rates.update")
  updatePair(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: UpdateExchangeRatesPairDto,
  ) {
    return this.rates.updatePair(actor, dto, meta);
  }

  @Patch()
  @RequirePermission("exchange_rates.update")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Body() dto: UpdateExchangeRateDto,
  ) {
    return this.rates.update(actor, dto, meta);
  }
}