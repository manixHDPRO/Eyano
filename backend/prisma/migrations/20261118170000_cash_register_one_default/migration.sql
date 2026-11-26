-- Palier 7 : une seule caisse par défaut par boutique.
CREATE UNIQUE INDEX cash_registers_one_default_per_store_uidx
  ON "cash_registers" (store_id)
  WHERE is_default = true;
