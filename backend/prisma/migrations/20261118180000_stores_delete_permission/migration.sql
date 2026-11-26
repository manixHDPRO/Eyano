INSERT INTO "permissions" ("code", "module", "description")
VALUES ('stores.delete', 'stores', 'Supprimer définitivement les boutiques')
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'SUPER_ADMIN'
  AND p."code" = 'stores.delete'
ON CONFLICT DO NOTHING;