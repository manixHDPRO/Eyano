-- Transfert expédié : alerte caisse pour accusé de réception
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'TRANSFER_SHIPPED';

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