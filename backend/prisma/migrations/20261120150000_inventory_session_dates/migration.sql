-- Début d'inventaire à l'ouverture (start), fin à la clôture (validation ou annulation).

ALTER TABLE "inventory_sessions" ALTER COLUMN "started_at" DROP DEFAULT;
ALTER TABLE "inventory_sessions" ALTER COLUMN "started_at" DROP NOT NULL;

ALTER TABLE "inventory_sessions" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ;

UPDATE "inventory_sessions"
SET "started_at" = NULL
WHERE "status" = 'DRAFT';

UPDATE "inventory_sessions"
SET "closed_at" = "validated_at"
WHERE "validated_at" IS NOT NULL;

UPDATE "inventory_sessions"
SET "closed_at" = "updated_at"
WHERE "status" = 'CANCELLED' AND "closed_at" IS NULL;