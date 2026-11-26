-- Rôle CASHIER : réception de transfert (seed mis à jour, bases existantes sans la liaison)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'CASHIER'
  AND p.code = 'transfers.receive'
ON CONFLICT DO NOTHING;