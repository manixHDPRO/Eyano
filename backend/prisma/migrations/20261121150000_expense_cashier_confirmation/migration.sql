-- Dépenses tiroir : confirmation caissière
DO $$ BEGIN
  CREATE TYPE "expense_status" AS ENUM ('CONFIRMED', 'PENDING_CASHIER_CONFIRMATION', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'EXPENSE_DRAWER_PENDING';

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "status" "expense_status" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN IF NOT EXISTS "cash_register_id" UUID,
  ADD COLUMN IF NOT EXISTS "cashier_confirmed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cashier_confirmed_by" UUID;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_cash_register_id_fkey"
    FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_cashier_confirmed_by_fkey"
    FOREIGN KEY ("cashier_confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "expenses_store_id_status_idx" ON "expenses"("store_id", "status");
CREATE INDEX IF NOT EXISTS "expenses_cash_register_id_status_idx" ON "expenses"("cash_register_id", "status");

INSERT INTO "app_settings" ("key", "group", "value", "value_type", "is_critical", "description", "updated_at")
VALUES (
  'notifications.EXPENSE_DRAWER_PENDING',
  'notifications',
  'true'::jsonb,
  'BOOLEAN',
  false,
  'Alerte caisse : dépense tiroir en attente de confirmation caissière',
  NOW()
)
ON CONFLICT ("key") DO NOTHING;