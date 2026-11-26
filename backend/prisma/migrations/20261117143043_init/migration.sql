-- Palier 2 : fonction UUID v7, schema Prisma, contraintes ARCHITECTURE §4.
-- UUID v7 portable (PostgreSQL 16+). pgcrypto fournit gen_random_bytes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION eyano_uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
  uuid_bytes := unix_ts_ms || gen_random_bytes(10);
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "referential_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "category_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "barcode_symbology" AS ENUM ('CODE128');

-- CreateEnum
CREATE TYPE "print_context" AS ENUM ('SINGLE', 'BATCH');

-- CreateEnum
CREATE TYPE "currency_code" AS ENUM ('USD', 'CDF');

-- CreateEnum
CREATE TYPE "movement_type" AS ENUM ('GOODS_RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'SALE', 'SALE_REVERSAL', 'INTERNAL_ISSUE', 'INVENTORY_ADJUSTMENT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "movement_direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "goods_receipt_status" AS ENUM ('DRAFT', 'VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('DRAFT', 'PENDING', 'VALIDATED', 'PREPARING', 'SHIPPED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "scope_type" AS ENUM ('WAREHOUSE', 'STORE');

-- CreateEnum
CREATE TYPE "inventory_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_VALIDATION', 'VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "internal_issue_reason" AS ENUM ('CLEANING', 'MAINTENANCE', 'INTERNAL_USE', 'DAMAGED', 'OTHER');

-- CreateEnum
CREATE TYPE "internal_issue_status" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "cash_session_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "sale_status" AS ENUM ('COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'MPESA', 'ORANGE_MONEY', 'AIRTEL_MONEY');

-- CreateEnum
CREATE TYPE "exchange_rate_type" AS ENUM ('ENCAISSEMENT', 'DECAISSEMENT');

-- CreateEnum
CREATE TYPE "document_sequence_code" AS ENUM ('SALE', 'TRANSFER', 'RECEIPT', 'EXPENSE', 'INVENTORY', 'INTERNAL_ISSUE');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('LOW_STOCK', 'STOCKOUT', 'TRANSFER_PENDING', 'TRANSFER_RECEIVED', 'INVENTORY_VARIANCE', 'CASH_VARIANCE', 'INTERNAL_ISSUE_PENDING', 'PRICE_CHANGED', 'DISCOUNT_CHANGED', 'RATE_CHANGED');

-- CreateEnum
CREATE TYPE "notification_severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "setting_value_type" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "role_id" UUID NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "password_changed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_users" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "store_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "store_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "replaced_by" UUID,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_histories" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "user_id" UUID,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "status" "referential_status" NOT NULL DEFAULT 'ACTIVE',
    "receipt_header" TEXT,
    "receipt_footer" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "status" "referential_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "store_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "referential_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "category_status" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "brand" TEXT,
    "origin_country" TEXT,
    "description" TEXT,
    "photo_path" TEXT,
    "purchase_price" DECIMAL(18,2) NOT NULL,
    "official_price" DECIMAL(18,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "final_price" DECIMAL(18,2) NOT NULL,
    "alert_threshold" INTEGER,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcodes" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "product_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "symbology" "barcode_symbology" NOT NULL DEFAULT 'CODE128',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_print_logs" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "barcode_id" UUID NOT NULL,
    "printed_by" UUID NOT NULL,
    "copies" INTEGER NOT NULL,
    "context" "print_context" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcode_print_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_stores" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "is_authorized" BOOLEAN NOT NULL DEFAULT true,
    "authorized_by" UUID,
    "authorized_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "product_id" UUID NOT NULL,
    "purchase_price" DECIMAL(18,2) NOT NULL,
    "official_price" DECIMAL(18,2) NOT NULL,
    "currency" "currency_code" NOT NULL DEFAULT 'USD',
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "reason" TEXT,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_discounts" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "product_id" UUID NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "reason" TEXT,

    CONSTRAINT "product_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "store_id" UUID,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "product_id" UUID NOT NULL,
    "movement_type" "movement_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" "movement_direction" NOT NULL,
    "warehouse_id" UUID,
    "store_id" UUID,
    "unit_cost" DECIMAL(18,2),
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "note" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "country" TEXT,
    "status" "referential_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "reference" TEXT NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ,
    "status" "goods_receipt_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "validated_by" UUID,
    "validated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "goods_receipt_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(18,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "reference" TEXT NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "status" "transfer_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "validated_by" UUID,
    "shipped_by" UUID,
    "received_by" UUID,
    "validated_at" TIMESTAMPTZ,
    "shipped_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "transfer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_requested" INTEGER NOT NULL,
    "quantity_shipped" INTEGER NOT NULL DEFAULT 0,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(18,2),

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_sessions" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "reference" TEXT NOT NULL,
    "scope_type" "scope_type" NOT NULL,
    "warehouse_id" UUID,
    "store_id" UUID,
    "status" "inventory_status" NOT NULL DEFAULT 'DRAFT',
    "started_by" UUID NOT NULL,
    "validated_by" UUID,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMPTZ,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "inventory_session_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "theoretical_qty" INTEGER NOT NULL,
    "physical_qty" INTEGER,
    "variance" INTEGER,
    "justification" TEXT,
    "initial_qty" INTEGER NOT NULL DEFAULT 0,
    "receipts_qty" INTEGER NOT NULL DEFAULT 0,
    "transfers_in_qty" INTEGER NOT NULL DEFAULT 0,
    "sales_qty" INTEGER NOT NULL DEFAULT 0,
    "transfers_out_qty" INTEGER NOT NULL DEFAULT 0,
    "internal_issues_qty" INTEGER NOT NULL DEFAULT 0,
    "adjustments_qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_stock_issues" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "reference" TEXT NOT NULL,
    "scope_type" "scope_type" NOT NULL,
    "warehouse_id" UUID,
    "store_id" UUID,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason_code" "internal_issue_reason" NOT NULL,
    "reason_text" TEXT,
    "status" "internal_issue_status" NOT NULL DEFAULT 'DRAFT',
    "requested_by" UUID NOT NULL,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_stock_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "cash_register_id" UUID NOT NULL,
    "opened_by" UUID NOT NULL,
    "closed_by" UUID,
    "status" "cash_session_status" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "opening_float_usd" DECIMAL(18,2) NOT NULL,
    "opening_float_cdf" DECIMAL(18,0) NOT NULL,
    "expected_usd" DECIMAL(18,2),
    "expected_cdf" DECIMAL(18,0),
    "counted_usd" DECIMAL(18,2),
    "counted_cdf" DECIMAL(18,0),
    "variance_usd" DECIMAL(18,2),
    "variance_cdf" DECIMAL(18,0),
    "note" TEXT,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "number" TEXT NOT NULL,
    "store_id" UUID NOT NULL,
    "cash_session_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "status" "sale_status" NOT NULL DEFAULT 'COMPLETED',
    "currency" "currency_code" NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discount_total" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ,
    "voided_by" UUID,
    "void_reason" TEXT,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "reference_snapshot" TEXT NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "barcode_snapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "official_unit_price" DECIMAL(18,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "discount_amount" DECIMAL(18,2) NOT NULL,
    "final_unit_price" DECIMAL(18,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,
    "purchase_price_snapshot" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "sale_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "currency" "currency_code" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "amount_usd" DECIMAL(18,2) NOT NULL,
    "exchange_rate_id" UUID,
    "rate_snapshot" DECIMAL(18,6),
    "provider_reference" TEXT,
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "reference" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "currency_code" NOT NULL,
    "store_id" UUID,
    "warehouse_id" UUID,
    "cash_session_id" UUID,
    "spent_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID NOT NULL,
    "description" TEXT,
    "receipt_path" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "rate_type" "exchange_rate_type" NOT NULL,
    "base_currency" "currency_code" NOT NULL DEFAULT 'USD',
    "quote_currency" "currency_code" NOT NULL DEFAULT 'CDF',
    "rate" DECIMAL(18,6) NOT NULL,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "value_type" "setting_value_type" NOT NULL,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "code" "document_sequence_code" NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 6,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "type" "notification_type" NOT NULL,
    "severity" "notification_severity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "store_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,
    "read_by" UUID,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "store_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "store_users_user_id_idx" ON "store_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_users_store_id_user_id_key" ON "store_users"("store_id", "user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "login_histories_user_id_created_at_idx" ON "login_histories"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "cash_registers_store_id_idx" ON "cash_registers"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_store_id_code_key" ON "cash_registers"("store_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_reference_key" ON "products"("reference");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "barcodes_product_id_key" ON "barcodes"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "barcodes_code_key" ON "barcodes"("code");

-- CreateIndex
CREATE INDEX "barcode_print_logs_barcode_id_created_at_idx" ON "barcode_print_logs"("barcode_id", "created_at");

-- CreateIndex
CREATE INDEX "product_stores_store_id_idx" ON "product_stores"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_stores_product_id_store_id_key" ON "product_stores"("product_id", "store_id");

-- CreateIndex
CREATE INDEX "product_prices_product_id_valid_from_idx" ON "product_prices"("product_id", "valid_from");

-- CreateIndex
CREATE INDEX "product_discounts_product_id_valid_from_idx" ON "product_discounts"("product_id", "valid_from");

-- CreateIndex
CREATE INDEX "stock_levels_store_id_product_id_idx" ON "stock_levels"("store_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_levels_warehouse_id_product_id_idx" ON "stock_levels"("warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_occurred_at_idx" ON "stock_movements"("product_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_store_id_occurred_at_idx" ON "stock_movements"("store_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_warehouse_id_occurred_at_idx" ON "stock_movements"("warehouse_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_source_type_source_id_idx" ON "stock_movements"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_reference_key" ON "goods_receipts"("reference");

-- CreateIndex
CREATE INDEX "goods_receipts_warehouse_id_status_idx" ON "goods_receipts"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "goods_receipts"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipt_items_product_id_idx" ON "goods_receipt_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_items_goods_receipt_id_product_id_key" ON "goods_receipt_items"("goods_receipt_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_reference_key" ON "transfers"("reference");

-- CreateIndex
CREATE INDEX "transfers_store_id_status_idx" ON "transfers"("store_id", "status");

-- CreateIndex
CREATE INDEX "transfers_warehouse_id_status_idx" ON "transfers"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "transfer_items_product_id_idx" ON "transfer_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_items_transfer_id_product_id_key" ON "transfer_items"("transfer_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_sessions_reference_key" ON "inventory_sessions"("reference");

-- CreateIndex
CREATE INDEX "inventory_sessions_store_id_status_idx" ON "inventory_sessions"("store_id", "status");

-- CreateIndex
CREATE INDEX "inventory_sessions_warehouse_id_status_idx" ON "inventory_sessions"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "inventory_items_product_id_idx" ON "inventory_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_inventory_session_id_product_id_key" ON "inventory_items"("inventory_session_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_stock_issues_reference_key" ON "internal_stock_issues"("reference");

-- CreateIndex
CREATE INDEX "internal_stock_issues_status_idx" ON "internal_stock_issues"("status");

-- CreateIndex
CREATE INDEX "internal_stock_issues_product_id_idx" ON "internal_stock_issues"("product_id");

-- CreateIndex
CREATE INDEX "cash_sessions_cash_register_id_status_idx" ON "cash_sessions"("cash_register_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_number_key" ON "sales"("number");

-- CreateIndex
CREATE INDEX "sales_store_id_completed_at_idx" ON "sales"("store_id", "completed_at");

-- CreateIndex
CREATE INDEX "sales_cash_session_id_idx" ON "sales"("cash_session_id");

-- CreateIndex
CREATE INDEX "sales_cashier_id_idx" ON "sales"("cashier_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "payments_paid_at_method_idx" ON "payments"("paid_at", "method");

-- CreateIndex
CREATE INDEX "payments_sale_id_idx" ON "payments"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_reference_key" ON "expenses"("reference");

-- CreateIndex
CREATE INDEX "expenses_store_id_spent_at_idx" ON "expenses"("store_id", "spent_at");

-- CreateIndex
CREATE INDEX "expenses_warehouse_id_spent_at_idx" ON "expenses"("warehouse_id", "spent_at");

-- CreateIndex
CREATE INDEX "exchange_rates_rate_type_valid_from_idx" ON "exchange_rates"("rate_type", "valid_from");

-- CreateIndex
CREATE INDEX "app_settings_group_idx" ON "app_settings"("group");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_code_key" ON "document_sequences"("code");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_store_id_created_at_idx" ON "notifications"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_users" ADD CONSTRAINT "store_users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_users" ADD CONSTRAINT "store_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_users" ADD CONSTRAINT "store_users_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_fkey" FOREIGN KEY ("replaced_by") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_histories" ADD CONSTRAINT "login_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_print_logs" ADD CONSTRAINT "barcode_print_logs_barcode_id_fkey" FOREIGN KEY ("barcode_id") REFERENCES "barcodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_print_logs" ADD CONSTRAINT "barcode_print_logs_printed_by_fkey" FOREIGN KEY ("printed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_discounts" ADD CONSTRAINT "product_discounts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_discounts" ADD CONSTRAINT "product_discounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_shipped_by_fkey" FOREIGN KEY ("shipped_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_inventory_session_id_fkey" FOREIGN KEY ("inventory_session_id") REFERENCES "inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_stock_issues" ADD CONSTRAINT "internal_stock_issues_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_stock_issues" ADD CONSTRAINT "internal_stock_issues_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_stock_issues" ADD CONSTRAINT "internal_stock_issues_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_stock_issues" ADD CONSTRAINT "internal_stock_issues_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_stock_issues" ADD CONSTRAINT "internal_stock_issues_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_read_by_fkey" FOREIGN KEY ("read_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Contraintes métier ARCHITECTURE §4 (Prisma 6 ne les déclare pas en PSL).

-- Soldes : un seul lieu, quantités cohérentes
ALTER TABLE "stock_levels"
  ADD CONSTRAINT stock_levels_exclusive_location
  CHECK (
    (warehouse_id IS NOT NULL AND store_id IS NULL)
    OR (warehouse_id IS NULL AND store_id IS NOT NULL)
  );

ALTER TABLE "stock_levels"
  ADD CONSTRAINT stock_levels_qty_on_hand_nonneg
  CHECK (quantity_on_hand >= 0);

ALTER TABLE "stock_levels"
  ADD CONSTRAINT stock_levels_qty_reserved_nonneg
  CHECK (quantity_reserved >= 0);

ALTER TABLE "stock_levels"
  ADD CONSTRAINT stock_levels_reserved_lte_on_hand
  CHECK (quantity_reserved <= quantity_on_hand);

CREATE UNIQUE INDEX stock_levels_product_warehouse_uidx
  ON "stock_levels" (product_id, warehouse_id)
  WHERE warehouse_id IS NOT NULL;

CREATE UNIQUE INDEX stock_levels_product_store_uidx
  ON "stock_levels" (product_id, store_id)
  WHERE store_id IS NOT NULL;

-- Une seule ligne tarifaire / remise ouverte par produit
CREATE UNIQUE INDEX product_prices_open_uidx
  ON "product_prices" (product_id)
  WHERE valid_to IS NULL;

CREATE UNIQUE INDEX product_discounts_open_uidx
  ON "product_discounts" (product_id)
  WHERE valid_to IS NULL;

ALTER TABLE "product_prices"
  ADD CONSTRAINT product_prices_amounts_nonneg
  CHECK (purchase_price >= 0 AND official_price >= 0);

ALTER TABLE "product_discounts"
  ADD CONSTRAINT product_discounts_percent_range
  CHECK (percent >= 0 AND percent <= 100);

ALTER TABLE "products"
  ADD CONSTRAINT products_discount_percent_range
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

ALTER TABLE "products"
  ADD CONSTRAINT products_prices_nonneg
  CHECK (purchase_price >= 0 AND official_price >= 0 AND final_price >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT products_alert_threshold_nonneg
  CHECK (alert_threshold IS NULL OR alert_threshold >= 0);

-- Mouvements : quantité strictement positive, un lieu
ALTER TABLE "stock_movements"
  ADD CONSTRAINT stock_movements_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT stock_movements_exclusive_location
  CHECK (
    (warehouse_id IS NOT NULL AND store_id IS NULL)
    OR (warehouse_id IS NULL AND store_id IS NOT NULL)
  );

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT goods_receipt_items_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT goods_receipt_items_unit_cost_nonneg
  CHECK (unit_cost >= 0);

ALTER TABLE "transfer_items"
  ADD CONSTRAINT transfer_items_qty_requested_positive
  CHECK (quantity_requested > 0);

ALTER TABLE "transfer_items"
  ADD CONSTRAINT transfer_items_qty_shipped_nonneg
  CHECK (quantity_shipped >= 0);

ALTER TABLE "transfer_items"
  ADD CONSTRAINT transfer_items_qty_received_nonneg
  CHECK (quantity_received >= 0);

ALTER TABLE "internal_stock_issues"
  ADD CONSTRAINT internal_stock_issues_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE "internal_stock_issues"
  ADD CONSTRAINT internal_stock_issues_exclusive_location
  CHECK (
    (scope_type = 'WAREHOUSE' AND warehouse_id IS NOT NULL AND store_id IS NULL)
    OR (scope_type = 'STORE' AND store_id IS NOT NULL AND warehouse_id IS NULL)
  );

ALTER TABLE "inventory_sessions"
  ADD CONSTRAINT inventory_sessions_exclusive_location
  CHECK (
    (scope_type = 'WAREHOUSE' AND warehouse_id IS NOT NULL AND store_id IS NULL)
    OR (scope_type = 'STORE' AND store_id IS NOT NULL AND warehouse_id IS NULL)
  );

ALTER TABLE "expenses"
  ADD CONSTRAINT expenses_exclusive_location
  CHECK (
    (warehouse_id IS NOT NULL AND store_id IS NULL)
    OR (warehouse_id IS NULL AND store_id IS NOT NULL)
  );

ALTER TABLE "expenses"
  ADD CONSTRAINT expenses_amount_positive
  CHECK (amount > 0);

ALTER TABLE "sale_items"
  ADD CONSTRAINT sale_items_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE "sale_items"
  ADD CONSTRAINT sale_items_amounts_nonneg
  CHECK (
    official_unit_price >= 0
    AND discount_percent >= 0 AND discount_percent <= 100
    AND discount_amount >= 0
    AND final_unit_price >= 0
    AND line_total >= 0
    AND purchase_price_snapshot >= 0
  );

ALTER TABLE "sales"
  ADD CONSTRAINT sales_totals_nonneg
  CHECK (subtotal >= 0 AND discount_total >= 0 AND total >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT payments_amount_positive
  CHECK (amount > 0 AND amount_usd >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT payments_mobile_money_reference
  CHECK (method = 'CASH' OR provider_reference IS NOT NULL);

ALTER TABLE "barcode_print_logs"
  ADD CONSTRAINT barcode_print_logs_copies_positive
  CHECK (copies > 0);

ALTER TABLE "document_sequences"
  ADD CONSTRAINT document_sequences_next_positive
  CHECK (next_number >= 1 AND padding >= 0);

ALTER TABLE "cash_sessions"
  ADD CONSTRAINT cash_sessions_floats_nonneg
  CHECK (opening_float_usd >= 0 AND opening_float_cdf >= 0);

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT exchange_rates_rate_positive
  CHECK (rate > 0);

CREATE UNIQUE INDEX cash_sessions_open_per_register_uidx
  ON "cash_sessions" (cash_register_id)
  WHERE status = 'OPEN';

CREATE UNIQUE INDEX exchange_rates_open_per_type_uidx
  ON "exchange_rates" (rate_type)
  WHERE valid_to IS NULL;

CREATE INDEX notifications_unread_created_idx
  ON "notifications" (created_at)
  WHERE read_at IS NULL;
