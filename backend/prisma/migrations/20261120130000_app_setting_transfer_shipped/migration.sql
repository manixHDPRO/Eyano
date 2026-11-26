-- Paramètre applicatif pour l'alerte caisse (bases déjà seedées avant l'ajout de la clé)
INSERT INTO "app_settings" ("key", "group", "value", "value_type", "is_critical", "description", "updated_at")
VALUES (
  'notifications.TRANSFER_SHIPPED',
  'notifications',
  'true'::jsonb,
  'BOOLEAN',
  false,
  'Alerte caisse : transfert expédié à réceptionner',
  NOW()
)
ON CONFLICT ("key") DO NOTHING;