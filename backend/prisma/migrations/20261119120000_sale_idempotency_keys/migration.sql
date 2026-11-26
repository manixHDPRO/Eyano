-- Palier 16 — clés d'idempotence vente
CREATE TABLE "sale_idempotency_keys" (
    "id" UUID NOT NULL DEFAULT eyano_uuid_v7(),
    "key_hash" TEXT NOT NULL,
    "sale_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sale_idempotency_keys_key_hash_key" ON "sale_idempotency_keys"("key_hash");
CREATE UNIQUE INDEX "sale_idempotency_keys_sale_id_key" ON "sale_idempotency_keys"("sale_id");

ALTER TABLE "sale_idempotency_keys" ADD CONSTRAINT "sale_idempotency_keys_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_idempotency_keys" ADD CONSTRAINT "sale_idempotency_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;