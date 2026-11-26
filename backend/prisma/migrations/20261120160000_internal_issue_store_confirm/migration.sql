ALTER TABLE "internal_stock_issues"
  ADD COLUMN IF NOT EXISTS "store_confirmed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "store_confirmed_by" UUID;

ALTER TABLE "internal_stock_issues"
  ADD CONSTRAINT "internal_stock_issues_store_confirmed_by_fkey"
  FOREIGN KEY ("store_confirmed_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "app_settings" ("key", "group", "value", "value_type", "is_critical", "description")
VALUES (
  'stock.internal_issue_requires_store_confirmation',
  'stock',
  'true'::jsonb,
  'BOOLEAN',
  false,
  'La boutique doit confirmer en caisse avant validation centrale'
)
ON CONFLICT ("key") DO NOTHING;