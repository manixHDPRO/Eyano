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

CREATE UNIQUE INDEX cash_registers_one_default_per_store_uidx
  ON "cash_registers" (store_id)
  WHERE is_default = true;

CREATE UNIQUE INDEX cash_sessions_open_per_register_uidx
  ON "cash_sessions" (cash_register_id)
  WHERE status = 'OPEN';

CREATE UNIQUE INDEX exchange_rates_open_per_type_uidx
  ON "exchange_rates" (rate_type)
  WHERE valid_to IS NULL;

CREATE INDEX notifications_unread_created_idx
  ON "notifications" (created_at)
  WHERE read_at IS NULL;
