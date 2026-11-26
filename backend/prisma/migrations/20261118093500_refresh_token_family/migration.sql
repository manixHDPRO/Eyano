-- Palier 4 : famille de rotation + unicité du hash de refresh.
-- Les jetons existants, s'il y en a, forment chacun leur propre famille.

ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" UUID;

UPDATE "refresh_tokens" SET "family_id" = "id" WHERE "family_id" IS NULL;

ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;

CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
