import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import appConfig from "./config/app.config";
import authConfig from "./config/auth.config";
import { AccessModule } from "./common/access/access.module";
import { AccessDemoModule } from "./modules/access-demo/access-demo.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { LoginHistoriesModule } from "./modules/login-histories/login-histories.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BarcodesModule } from "./modules/barcodes/barcodes.module";
import { CashRegistersModule } from "./modules/cash-registers/cash-registers.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { HealthModule } from "./modules/health/health.module";
import { ProductsModule } from "./modules/products/products.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { DiscountsModule } from "./modules/discounts/discounts.module";
import { PricingModule } from "./modules/pricing/pricing.module";
import { RolesModule } from "./modules/roles/roles.module";
import { StoresModule } from "./modules/stores/stores.module";
import { UsersModule } from "./modules/users/users.module";
import { WarehousesModule } from "./modules/warehouses/warehouses.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { StockMovementsModule } from "./modules/stock-movements/stock-movements.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { InternalIssuesModule } from "./modules/internal-issues/internal-issues.module";
import { CashSessionsModule } from "./modules/cash-sessions/cash-sessions.module";
import { SalesModule } from "./modules/sales/sales.module";
import { PosModule } from "./modules/pos/pos.module";
import { ExchangeRatesModule } from "./modules/exchange-rates/exchange-rates.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SequencesModule } from "./common/sequences/sequences.module";
import { PrismaModule } from "./prisma/prisma.module";

const optionalModules =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_ACCESS_DEMO === "true" ? [AccessDemoModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig],
      envFilePath: [".env", ".env.local"],
    }),
    PrismaModule,
    SequencesModule,
    AccessModule,
    AuditLogsModule,
    LoginHistoriesModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StoresModule,
    WarehousesModule,
    CashRegistersModule,
    CategoriesModule,
    ProductsModule,
    BarcodesModule,
    RolesModule,
    PermissionsModule,
    PricingModule,
    DiscountsModule,
    StockMovementsModule,
    TransfersModule,
    InventoryModule,
    InternalIssuesModule,
    CashSessionsModule,
    SalesModule,
    PosModule,
    ExchangeRatesModule,
    PaymentsModule,
    ExpensesModule,
    NotificationsModule,
    SettingsModule,
    SuppliersModule,
    DashboardModule,
    ReportsModule,
    ...optionalModules,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
