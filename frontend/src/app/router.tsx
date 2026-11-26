import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdministrationSectionLayout } from "./layouts/AdministrationSectionLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { PosLayout } from "./layouts/PosLayout";
import { ChangePasswordPage } from "../modules/auth/ChangePasswordPage";
import { LoginPage } from "../modules/auth/LoginPage";
import { RequireAdminAccess } from "../modules/auth/RequireAdminAccess";
import { RequireAdminNavSection } from "../modules/auth/RequireAdminNavSection";
import { RequireAuth } from "../modules/auth/RequireAuth";
import { RequirePermission } from "../modules/auth/RequirePermission";
import { AdminComingSoonPage } from "../modules/dashboard/AdminComingSoonPage";
import { AdminHomePage } from "../modules/dashboard/AdminHomePage";
import { PosHomePage } from "../modules/pos/PosHomePage";
import { PosInternalIssuesConfirmPage } from "../modules/pos/PosInternalIssuesConfirmPage";
import { PosConfirmExpensesPage } from "../modules/pos/PosConfirmExpensesPage";
import { PosTransfersReceivePage } from "../modules/pos/PosTransfersReceivePage";
import { CategoriesPage } from "../modules/catalog/CategoriesPage";
import { ProductEditorPage } from "../modules/catalog/ProductEditorPage";
import { ProductsListPage } from "../modules/catalog/ProductsListPage";
import { CashRegistersPage } from "../modules/network/CashRegistersPage";
import { StoreEditorPage } from "../modules/network/StoreEditorPage";
import { StoresListPage } from "../modules/network/StoresListPage";
import { WarehousePage } from "../modules/network/WarehousePage";
import { UserEditorPage } from "../modules/users/UserEditorPage";
import { BarcodesPage } from "../modules/barcodes/BarcodesPage";
import { PricingPage } from "../modules/pricing/PricingPage";
import { UsersListPage } from "../modules/users/UsersListPage";
import { SuppliersListPage } from "../modules/suppliers/SuppliersListPage";
import { SupplierEditorPage } from "../modules/suppliers/SupplierEditorPage";
import { CentralWarehousePage } from "../modules/stock/CentralWarehousePage";
import { StockPage } from "../modules/stock/StockPage";
import { TransfersListPage } from "../modules/transfers/TransfersListPage";
import { TransferEditorPage } from "../modules/transfers/TransferEditorPage";
import { InventoriesListPage } from "../modules/inventories/InventoriesListPage";
import { InternalIssuesListPage } from "../modules/internal-issues/InternalIssuesListPage";
import { InternalIssueEditorPage } from "../modules/internal-issues/InternalIssueEditorPage";
import { ExchangeRatesPage } from "../modules/finance/ExchangeRatesPage";
import { PaymentsListPage } from "../modules/finance/PaymentsListPage";
import { ExpensesListPage } from "../modules/finance/ExpensesListPage";
import { CashSessionDetailPage } from "../modules/sales/CashSessionDetailPage";
import { CashSessionsListPage } from "../modules/sales/CashSessionsListPage";
import { SaleDetailPage } from "../modules/sales/SaleDetailPage";
import { SalesListPage } from "../modules/sales/SalesListPage";
import { AdministrationRedirect } from "../modules/administration/AdministrationRedirect";
import { PresentationPage } from "../modules/administration/PresentationPage";
import { AppSettingsPage } from "../modules/administration/AppSettingsPage";
import { NotificationsCenterPage } from "../modules/notifications/NotificationsCenterPage";
import { AuditJournalPage } from "../modules/audit/AuditJournalPage";
import { LoginHistoryJournalPage } from "../modules/login-history/LoginHistoryJournalPage";
import { ReportsPage } from "../modules/reports/ReportsPage";
import { TopSellingProductsPage } from "../modules/reports/TopSellingProductsPage";
import { NOTIFICATION_READ_PERMISSIONS } from "../lib/auth/notification-access";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/account/password" element={<ChangePasswordPage />} />
          <Route element={<RequireAdminAccess />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminHomePage />} />
              <Route element={<AdministrationSectionLayout />}>
                <Route path="/admin/administration" element={<AdministrationRedirect />} />
                <Route path="/admin/presentation" element={<PresentationPage />} />
                <Route
                  path="/admin/users"
                  element={
                    <RequirePermission anyOf={["users.manage", "roles.manage"]}>
                      <UsersListPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/users/:id"
                  element={
                    <RequirePermission permission="users.manage">
                      <UserEditorPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/stores"
                  element={
                    <RequirePermission permission="stores.manage">
                      <StoresListPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/stores/:id"
                  element={
                    <RequirePermission permission="stores.manage">
                      <StoreEditorPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/warehouse"
                  element={
                    <RequirePermission anyOf={["stores.manage", "stock.read"]}>
                      <WarehousePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <RequirePermission anyOf={["settings.update", "settings.update_critical"]}>
                      <AppSettingsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/notifications"
                  element={
                    <RequirePermission anyOf={NOTIFICATION_READ_PERMISSIONS}>
                      <NotificationsCenterPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/audit"
                  element={
                    <RequirePermission permission="audit.read">
                      <AuditJournalPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/admin/login-history"
                  element={
                    <RequirePermission permission="audit.read">
                      <LoginHistoryJournalPage />
                    </RequirePermission>
                  }
                />
                <Route path="/admin/preview/audit" element={<Navigate to="/admin/audit" replace />} />
                <Route path="/admin/preview/login-history" element={<Navigate to="/admin/login-history" replace />} />
                <Route
                  path="/admin/preview/:section"
                  element={
                    <RequireAdminNavSection>
                      <AdminComingSoonPage />
                    </RequireAdminNavSection>
                  }
                />
              </Route>
              <Route
                path="/admin/cash-registers"
                element={
                  <RequirePermission permission="stores.manage">
                    <CashRegistersPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <RequirePermission permission="products.manage">
                    <CategoriesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/products"
                element={
                  <RequirePermission anyOf={["products.manage", "products.read"]}>
                    <ProductsListPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/products/new"
                element={
                  <RequirePermission permission="products.manage">
                    <ProductEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/products/:id"
                element={
                  <RequirePermission anyOf={["products.manage", "products.read"]}>
                    <ProductEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/pricing"
                element={
                  <RequirePermission anyOf={["prices.update", "discounts.update", "products.read", "products.manage"]}>
                    <PricingPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/barcodes"
                element={
                  <RequirePermission anyOf={["barcodes.print", "products.manage", "products.read"]}>
                    <BarcodesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/suppliers"
                element={
                  <RequirePermission anyOf={["suppliers.manage", "suppliers.read"]}>
                    <SuppliersListPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/suppliers/new"
                element={
                  <RequirePermission permission="suppliers.manage">
                    <SupplierEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/suppliers/:id"
                element={
                  <RequirePermission anyOf={["suppliers.manage", "suppliers.read"]}>
                    <SupplierEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/central-warehouse"
                element={
                  <RequirePermission anyOf={["stock.read", "receipts.validate", "suppliers.manage", "suppliers.read"]}>
                    <CentralWarehousePage />
                  </RequirePermission>
                }
              />
              <Route path="/admin/goods-receipts/*" element={<Navigate to="/admin/central-warehouse" replace />} />
              <Route
                path="/admin/stock"
                element={
                  <RequirePermission permission="stock.read">
                    <StockPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/transfers"
                element={
                  <RequirePermission
                    anyOf={["transfers.create", "transfers.validate", "transfers.prepare_ship", "transfers.receive"]}
                  >
                    <TransfersListPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/transfers/new"
                element={
                  <RequirePermission permission="transfers.create">
                    <TransferEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/transfers/:id"
                element={
                  <RequirePermission
                    anyOf={["transfers.create", "transfers.validate", "transfers.prepare_ship", "transfers.receive"]}
                  >
                    <TransferEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/inventories"
                element={
                  <RequirePermission anyOf={["inventory.conduct", "inventory.validate"]}>
                    <InventoriesListPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/inventories/:id"
                element={
                  <RequirePermission anyOf={["inventory.conduct", "inventory.validate"]}>
                    <InventoriesListPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/internal-issues"
                element={
                  <RequirePermission anyOf={["internal_issues.request", "internal_issues.validate"]}>
                    <InternalIssuesListPage />
                  </RequirePermission>
                }
              />
              <Route path="/admin/internal-issues/new" element={<Navigate to="/admin/internal-issues" replace />} />
              <Route
                path="/admin/internal-issues/:id"
                element={
                  <RequirePermission anyOf={["internal_issues.request", "internal_issues.validate"]}>
                    <InternalIssueEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/exchange-rates"
                element={
                  <RequirePermission anyOf={["exchange_rates.update", "reports.read"]}>
                    <ExchangeRatesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/payments"
                element={
                  <RequirePermission anyOf={["reports.read", "sales.void", "sales.create"]}>
                    <PaymentsListPage />
                  </RequirePermission>
                }
              />
              <Route path="/admin/preview/payments" element={<Navigate to="/admin/payments" replace />} />
              <Route
                path="/admin/expenses"
                element={
                  <RequirePermission anyOf={["expenses.manage", "reports.read"]}>
                    <ExpensesListPage />
                  </RequirePermission>
                }
              />
              <Route path="/admin/preview/expenses" element={<Navigate to="/admin/expenses" replace />} />
              <Route path="/admin/preview/notifications" element={<Navigate to="/admin/notifications" replace />} />
              <Route
                path="/admin/sales"
                element={
                  <RequirePermission anyOf={["reports.read", "sales.void", "sales.create"]}>
                    <SalesListPage />
                  </RequirePermission>
                }
              >
                <Route path=":id" element={<SaleDetailPage />} />
              </Route>
              <Route
                path="/admin/cash-sessions"
                element={
                  <RequirePermission anyOf={["cash.session", "reports.read"]}>
                    <CashSessionsListPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/cash-sessions/:id"
                element={
                  <RequirePermission anyOf={["cash.session", "reports.read"]}>
                    <CashSessionDetailPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <RequirePermission permission="reports.read">
                    <ReportsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/reports/top-selling"
                element={
                  <RequirePermission permission="reports.read">
                    <TopSellingProductsPage />
                  </RequirePermission>
                }
              />
              <Route path="/admin/preview/reports" element={<Navigate to="/admin/reports" replace />} />
            </Route>
          </Route>
          <Route element={<PosLayout />}>
            <Route path="/pos" element={<PosHomePage />} />
            <Route
              path="/pos/receive-transfers"
              element={
                <RequirePermission anyOf={["transfers.receive", "transfers.create", "transfers.validate", "transfers.prepare_ship"]}>
                  <PosTransfersReceivePage />
                </RequirePermission>
              }
            />
            <Route
              path="/pos/confirm-internal-issues"
              element={
                <RequirePermission permission="stock.read">
                  <PosInternalIssuesConfirmPage />
                </RequirePermission>
              }
            />
            <Route
              path="/pos/confirm-expenses"
              element={
                <RequirePermission permission="cash.session">
                  <PosConfirmExpensesPage />
                </RequirePermission>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}