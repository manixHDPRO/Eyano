# Eyano — Guide des 20 paliers (pas à pas)

**Référence :** [ARCHITECTURE.md](./ARCHITECTURE.md)  
**Statut (2026-11-25) :** paliers **1**, **2**, **8**, **9** et **12** validés — paliers **3** à **7**, **10**, **11** et **13** à **19** développés, fiches en attente de validation formelle — palier **20** : partie applicative développée (audit, notifications, historique de connexion), durcissement VPS / sauvegardes non commencés. Les paliers 4 à 7, 10–11 et 13–20 ont été enchaînés sur instruction du maître d’ouvrage avant clôture formelle des fiches.

---

## Journal des validations

| Palier | Date | Décision | Palier suivant |
|:---:|---|---|---|
| 1 | 2026-11-17 | Validé — ARCHITECTURE et décisions métier retenues (accord projet) | 2 autorisé |
| 2 | 2026-11-18 | Validé — schéma Prisma, migrations, seed, contraintes SQL ; écarts §6 retenus | 3 autorisé |
| 3 | 2026-11-18 | Développé — NestJS, Vite/React, health, déploiement brouillon. En attente de validation | 4 autorisé par instruction MOA |
| 4 | 2026-11-18 | Développé — JWT, refresh rotatif, verrouillage, login UI. En attente de validation | 5 autorisé par instruction MOA |
| 5 | 2026-11-18 | Développé — CRUD utilisateurs, guards permission + périmètre, UI admin utilisateurs. En attente de validation | 6 autorisé par instruction MOA |
| 6 | 2026-11-18 | Développé — coque admin, menu par permissions, UI partagée. En attente de validation | 7 autorisé par instruction MOA |
| 7 | 2026-11-18 | Développé — CRUD boutiques, fiche entrepôt, caisses, audit minimal. En attente de validation | 8 autorisé par instruction MOA |
| 8 | 2026-11-19 | Validé — catalogue (catégories, produits, photo, autorisations boutiques), preuve caissier catalogue autorisé | 9 autorisé |
| 9 | 2026-11-19 | Validé — historique prix/remises, UI Prix & remises, backfill, e2e 7/7 | 10 autorisé |
| 10 | 2026-11-19 | Développé — Code 128, impression, journal. En attente de validation | 11 autorisé par instruction MOA |
| 11 | 2026-11-19 | Développé — fournisseurs, réceptions, StockMovementsService minimal. En attente de validation | 12 après validation |
| 12 | 2026-11-19 | Validé — StockMovementsService, API lecture/ajustement/réconciliation, alertes, UI `/admin/stock`, e2e 4/4 | 13 autorisé |
| 13 | 2026-11-19 | Développé — cycle transfert, réservation, écarts. En attente de validation | 14 autorisé par instruction MOA |
| 14 | 2026-11-19 | Développé — sorties internes, INTERNAL_ISSUE. En attente de validation | 15 autorisé par instruction MOA |
| 15 | 2026-11-19 | Développé — session de caisse, ventes, idempotence, POS. En attente de validation | 16 autorisé par instruction MOA |
| 16 | 2026-11-19 | Développé — paiements mixtes, taux, snapshots. En attente de validation | 17 autorisé par instruction MOA |
| 17 | 2026-11-25 | Développé — dépenses USD/CDF, tiroir, justificatifs. En attente de validation | 18 autorisé par instruction MOA |
| 18 | 2026-11-25 | Développé — agrégats, Recharts, export CSV, tableau de bord réel. En attente de validation | 19 autorisé par instruction MOA |
| 19 | 2026-11-25 | Développé — centre de paramètres, clés critiques, audit. En attente de validation | 20 autorisé par instruction MOA |
| 20 | 2026-11-25 | Développé (application) — lecture audit, notifications, historique connexions. VPS / sauvegardes non commencés | — |

---

## Règle de progression

Pour **chaque palier**, l’ordre est toujours le même :

1. **Présentation** — périmètre, dépendances, critères de fin.
2. **Développement** — tâches techniques numérotées.
3. **Tests** — preuves automatisées ou manuelles explicites.
4. **Validation** — accord écrit avant passage au palier suivant.

Les **invariants transverses** (à vérifier dès qu’ils deviennent applicables) :

| Invariant | Où il apparaît |
|---|---|
| Formule de prix (arrondi unitaire puis × quantité) | Palier 9, 15 |
| Refus de prix/remise envoyés par le client | Palier 15 |
| Stock négatif impossible | Palier 12, 15 |
| Séparation des stocks par lieu | Palier 12, 15 |
| Transfert incomplet (réservation / écart) | Palier 13 |
| Session de caisse (une ouverte par caisse) | Palier 15, 16 |

**Hors périmètre version 1 :** pas de Docker, pas de vente en ligne, pas d’API opérateurs Mobile Money, pas de multi-société, pas de sessions d’inventaire physique dans ce guide (cf. ARCHITECTURE § « Hors version 1 »). Un module `inventory` existe encore dans le code : il n’est pas un palier de ce document.

---

## Vue d’ensemble

| Palier | Thème | Dépend de | Statut |
|:---:|---|---|:---:|
| 1 | Analyse et conception | — | Validé |
| 2 | Schéma de données | 1 | Validé |
| 3 | Squelettes applicatifs | 2 | Développé — en attente |
| 4 | Authentification | 3 | Développé — en attente |
| 5 | Utilisateurs et permissions | 4 | Développé — en attente |
| 6 | Coque administration (UI) | 5 | Développé — en attente |
| 7 | Réseau (boutiques, entrepôt, caisses) | 5, 6 | Développé — en attente |
| 8 | Catalogue (catégories, produits) | 7 | Validé |
| 9 | Prix et remises | 8 | Validé |
| 10 | Codes-barres et impression | 8, 9 | Développé — en attente de validation |
| 11 | Fournisseurs et réceptions | 8, 12 (partiel) | Développé — en attente de validation |
| 12 | Soldes, mouvements, alertes | 2, 8, 11 | Validé |
| 13 | Transferts | 12, 7 | Développé — en attente |
| 14 | Sorties internes | 12 | Développé — en attente |
| 15 | Caisse et ventes | 9, 12, 7 | Développé — en attente |
| 16 | Paiements et taux | 15 | Développé — en attente |
| 17 | Dépenses | 15, 16 | Développé — en attente |
| 18 | Rapports et exports | 11–17 | Développé — en attente |
| 19 | Paramètres et historique | 5, 18 | Développé — en attente |
| 20 | Audit, sauvegardes, durcissement VPS | 3–19 | Application développée — VPS en attente |

---

## Palier 1 — Analyse et conception

**Statut : validé le 2026-11-17.**

**Livrable :** [ARCHITECTURE.md](./ARCHITECTURE.md) validé, décisions métier confirmées ou corrigées (inventaire hors périmètre).

### Pas à pas

1. Relire le cahier Eyano (sections 1 à 26) et cocher le périmètre version 1.
2. Valider ou ajuster le tableau **Décisions métier à confirmer** (A1–A18).
3. Valider l’architecture (NestJS, React/Vite, PostgreSQL 16, Nginx, PM2, VPS natif).
4. Valider le modèle relationnel et la matrice de permissions proposés.
5. Signer la **validation écrite** (e-mail, ticket, ou mention datée dans ce dépôt).

### Preuve de fin

- Document ARCHITECTURE marqué « validé » avec date et signataire.
- Aucun code `backend/` ni `frontend/` avant cet accord (sauf `docs/`).

### Tests

- Relecture croisée : chaque chapitre du cahier a une section correspondante dans ARCHITECTURE.

---

## Palier 2 — Schéma Prisma et migrations (sans logique métier)

**Statut : validé le 2026-11-18** (développement 2026-11-17).

**Livrable :** `schema.prisma`, migrations versionnées, **sans** services NestJS métier.

### Prérequis

- Palier 1 validé.

### Pas à pas

1. Créer l’arborescence `backend/prisma/` (cf. ARCHITECTURE § structure).
2. Traduire **toutes** les tables §3 (identité, réseau, catalogue, stock, transferts, sorties internes, ventes, finance, paramètres).
3. Appliquer les conventions : UUID v7, `timestamptz`, `NUMERIC` pour l’argent, enums de statuts, contraintes d’unicité partielle (prix/remise ouverts, session caisse ouverte).
4. Modéliser les contraintes métier au niveau SQL / Prisma : lieu exclusif sur `stock_levels`, `quantity_on_hand >= 0`, `quantity_reserved <= quantity_on_hand`, unicité codes-barres et références.
5. Préparer `seed.ts` **structurel uniquement** (rôles, permissions, super admin, taux initiaux, paramètres `app_settings`, entrepôt central) — pas de scénarios de vente complets.
6. Générer et appliquer les migrations sur PostgreSQL local natif.
7. Documenter les commandes : `migrate dev`, `migrate deploy`, `db seed`.

### Commandes (depuis `backend/`)

Copier `.env.example` vers `.env` et renseigner `DATABASE_URL`. Base locale : `eyano`.

```bash
npm install
npx prisma migrate dev          # développement : crée une migration si le schéma change
npx prisma migrate deploy       # applique les migrations versionnées (preuve de fin / prod)
npx prisma db seed              # seed structurel (rôles, permissions, super admin, taux, paramètres, entrepôt)
npx prisma generate             # régénère le client Prisma
npm run test:constraints        # insertions invalides rejetées par PostgreSQL
```

### Réalisation (2026-11-17)

- Prisma ORM **6.19.3** (commandes `migrate deploy` / `db seed` du palier ; Prisma 8 RC écarté : Node local 20.18, API encore RC, NestJS au palier 3).
- PostgreSQL local **18.1** (cible prod : 16). Fonction `eyano_uuid_v7()` portable via `pgcrypto`, sans extension tierce.
- 37 tables métier + `_prisma_migrations`. UUID v7 vérifié en base (nibble de version = 7).
- 30 contraintes `CHECK`, 6 index uniques partiels (prix/remise ouverts, session caisse ouverte, taux ouverts, solde par lieu).
- Seed : 6 rôles, 30 permissions, super admin `admin@eyano.local`, entrepôt `CENTRAL`, taux 24 000 / 22 500, 36 clés `app_settings`, 6 séquences documentaires.
- Hash du mot de passe seed : Argon2id via `hash-wasm` (pas de compilation native Windows). Mot de passe local : `SEED_SUPERADMIN_PASSWORD` dans `.env`.

Écarts **retenus** à la validation (2026-11-18) :

- Permissions `products.read` et `suppliers.read` pour la matrice §6.
- `login_histories.user_id` nullable.
### Preuve de fin

- `npx prisma migrate deploy` réussit sur une base vide (`eyano`, 2026-11-17).
- Re-déploiement immédiat : `No pending migrations to apply` (idempotent).
- Les contraintes listées en ARCHITECTURE §4 sont présentes (30 CHECK + index partiels, introspection `pg_constraint` / `pg_indexes`).

### Tests

- Migration sur base vide, puis re-migration idempotente : OK.
- Seed rejoué : OK.
- `npm run test:constraints` : 18 cas, tous OK (stock négatif, réservé > physique, lieu double, double prix ouvert, remise > 100 %, double session caisse, code-barres / référence dupliqués, Mobile Money sans référence).

```text
Palier n° : 2
Date : 2026-11-18
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : schema.prisma, migration 20261117143043_init, seed.ts, test:constraints
Tests exécutés : migrate deploy ×2, db seed ×2, test:constraints (18/18)
Écarts par rapport à ARCHITECTURE : retenus (products.read, suppliers.read, login_histories.user_id nullable)
Décision : [x] Validé  [ ] À corriger
Palier suivant autorisé : oui (palier 3 — squelettes ; déjà développé, fiche à clôturer)
```

---

## Palier 3 — Squelettes NestJS et Vite

**Livrable :** API et frontend démarrent en natif ; `GET /api/v1/health` opérationnel.

### Prérequis

- Palier 2.

### Pas à pas — Backend

1. Initialiser NestJS (TypeScript strict), préfixe global `/api/v1`.
2. Configurer Prisma comme module global (connexion, pas encore de domaines).
3. Créer le module `health` : statut, version, lien DB (ping simple).
4. Poser `common/` : filtres d’erreur `{ code, message, details }`, pipe de validation, structure des modules vides (dossiers seulement).
5. Préparer `main.ts` : CORS pour dev, Swagger désactivé ou guardé (prod).
6. Scripts `package.json` : `build`, `start:dev`, `test`.

### Pas à pas — Frontend

1. Initialiser Vite + React + TypeScript strict + Tailwind.
2. Router minimal : `/login` (placeholder), `/admin` (placeholder), `/pos` (placeholder).
3. Client API : base URL, gestion des erreurs normalisées.
4. Proxy Vite vers l’API en développement.

### Pas à pas — Déploiement (brouillon)

1. Créer `deploy/nginx/eyano.conf`, `deploy/pm2/ecosystem.config.cjs`, squelette `deploy/scripts/deploy.sh` (sans exécution prod obligatoire à ce stade).

### Preuve de fin

- `npm run start:dev` (backend) + `npm run dev` (frontend) sur machine locale.
- `curl http://localhost:3000/api/v1/health` → succès avec DB joignable.

### Tests

- Test e2e ou intégration minimal sur `/health`.

### Livré (2026-11-18)

- **Backend** : NestJS 11, préfixe `/api/v1`, `PrismaModule` global, `GET /health` (version + ping DB), filtre d’erreur `{ code, message, details }`, pipe de validation, dossiers modules vides (ARCHITECTURE §2), scripts `build` / `start:dev` / `test` / `test:e2e`.
- **Frontend** : Vite 6 + React 19 + Tailwind 4, routes `/login`, `/admin`, `/pos`, client API + proxy dev, UI sombre (accent or), carte santé API sur le tableau de bord.
- **Deploy** : `deploy/nginx/eyano.conf`, `deploy/pm2/ecosystem.config.cjs`, `deploy/scripts/deploy.sh` (squelette).

Écart documenté :

- Vite **6.4** retenu (et non Vite 8) : Node local **20.18** ; Vite 8 exige ≥ 20.19 et pose des soucis de binding Rolldown sous Windows.

### Preuve de fin

- `npm run build` + `npm test` + `npm run test:e2e` (backend) : OK.
- `npm run build` (frontend) : OK.
- `curl http://localhost:3000/api/v1/health` → `status: ok`, `database.status: up` (PostgreSQL local).

```text
Palier n° : 3
Date : 2026-11-18
Validé par : —
Résumé des livrables : backend NestJS, frontend Vite, deploy brouillon, health opérationnel
Tests exécutés : jest (2), e2e health (1), build backend + frontend
Écarts par rapport à ARCHITECTURE : Vite 6 au lieu de 8 (contrainte Node 20.18)
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (attendre validation paliers 2 et 3)
```

---

## Palier 4 — Auth JWT, refresh, verrouillage

**Livrable :** connexion, déconnexion, rotation du refresh, verrouillage après échecs.

### Prérequis

- Palier 3, tables `users`, `refresh_tokens`, `login_histories`, seed super admin.

### Pas à pas

1. Module `auth` : login (Argon2id), émission JWT accès **15 min**, refresh en cookie `httpOnly`, `Secure`, `SameSite=Strict`.
2. Rotation du refresh à chaque usage ; réutilisation d’un jeton révoqué → révocation de la famille.
3. Logout : révocation du refresh courant.
4. Verrouillage : `failed_login_count`, `locked_until` (seuils lus depuis `app_settings` ou constantes seed en attendant le palier 19).
5. Écrire `login_histories` à chaque tentative.
6. Guards : JWT sur routes protégées ; route publique `/auth/login`, `/auth/refresh`.
7. Frontend : formulaire login, stockage du token **en mémoire** (pas `localStorage`), intercepteur 401 → refresh.

### Preuve de fin

- Tests d’intégration : login OK, refresh OK, token expiré rejeté, compte verrouillé après N échecs, logout invalide le refresh.

### Tests

- Login / refresh / rejet / lockout automatisés.

### Livré (2026-11-18)

- **Backend** : `POST /api/v1/auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`. Argon2id (`hash-wasm`). JWT d’accès 15 min. Refresh en cookie `httpOnly`, `SameSite=Strict`, `Secure` en production, chemin `/api/v1/auth`. Rotation à chaque usage ; réutilisation d’un jeton révoqué → révocation de toute la famille. Verrouillage via `app_settings` (`security.max_failed_logins`, `security.lock_minutes`). `login_histories` à chaque tentative. Guard JWT global ; routes publiques : `/auth/login`, `/auth/refresh`, `/health`.
- **Schéma** : `refresh_tokens.family_id` + unicité `token_hash` (migration `20261118093500_refresh_token_family`).
- **Frontend** : formulaire de connexion, jeton d’accès **en mémoire** (pas de `localStorage`), restauration de session par refresh cookie, intercepteur 401 → refresh, `/admin` et `/pos` protégés, déconnexion.

Écarts documentés :

- `@nestjs/jwt` 12 (ESM) écarté : le backend Nest reste CommonJS (Node 20.18). Signature/vérification via `jsonwebtoken` (CJS).
- Colonne `family_id` absente du tableau ARCHITECTURE §3.1, ajoutée pour tenir l’invariant « révocation de la famille » sans parcourir une chaîne fragile.
- `GET /auth/me` n’est pas listé dans le pas-à-pas : nécessaire au frontend pour afficher l’utilisateur connecté (palier 5 enrichira le profil).
- Fiches de validation des paliers 2 et 3 encore ouvertes ; palier 4 développé sur instruction du maître d’ouvrage.

### Preuve de fin

- `npm test` (backend) : 10/10.
- `npm run test:e2e` : 7/7 (health + login, me, token expiré, rotation/réutilisation, logout, lockout).
- `npm run build` backend et frontend.

```text
Palier n° : 4
Date : 2026-11-18
Validé par : —
Résumé des livrables : auth JWT, refresh rotatif, verrouillage, login UI, token mémoire
Tests exécutés : jest unitaire (10), e2e auth + health
Écarts par rapport à ARCHITECTURE : jsonwebtoken à la place de @nestjs/jwt 12 ESM ; family_id sur refresh_tokens
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (attendre validation)
```

---

## Palier 5 — Utilisateurs, rôles, permissions, affectation boutique

**Livrable :** CRUD utilisateurs (hors logique métier avancée), matrice seedée, guards permission + périmètre.

### Prérequis

- Palier 4.

### Pas à pas — Backend

1. Modules `users`, `roles`, `permissions` : lecture catalogue permissions, affectation `role_permissions`.
2. `store_users` : affectation utilisateur ↔ boutique(s), `is_primary`.
3. Decorator `@RequirePermission('code')` + guard qui vérifie le rôle puis le périmètre boutique si applicable.
4. Seed : six rôles, permissions du tableau ARCHITECTURE §6, super admin protégé (garde-fou §5).
5. Endpoints admin : créer / désactiver utilisateur, assigner rôle, assigner boutiques (permissions `users.manage`).

### Pas à pas — Frontend (minimal)

1. Écrans liste / fiche utilisateur (administration), désactivés si pas la permission.

### Preuve de fin

- Tests : utilisateur sans `prices.update` reçoit 403 sur route prix ; caissier limité à ses boutiques sur routes scopées.

### Tests

- Matrice seedée conforme au document ; guard vérifié par tests ciblés.

### Réalisation (2026-11-18)

- `AccessModule` : `@RequirePermission`, `@StoreScoped`, `PermissionsGuard`, contexte d'accès chargé à chaque requête authentifiée.
- API : `users`, `roles`, `permissions`, lecture `stores` pour affectation ; points de preuve `pricing/policy-check` et `access-demo/store-scope`.
- Garde-fous : dernier super admin actif, interdiction de gérer ou d'attribuer `SUPER_ADMIN` hors super admin, `roles.manage` conservée sur le rôle seedé.
- Frontend : liste paginée, fiche création/édition, affectation boutiques, menu « Utilisateurs » masqué sans `users.manage`.
- Tests : `access.service.spec.ts`, e2e `users-permissions.e2e-spec.ts`.

```text
Palier n° : 5
Date : 2026-11-18
Validé par : —
Résumé des livrables : CRUD utilisateurs, guards permission + périmètre, UI admin
Tests exécutés : jest unitaire, e2e users-permissions + auth + health
Écarts par rapport à ARCHITECTURE : endpoint `stores` lecture seule anticipé (palier 7 pour le CRUD réseau)
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (attendre validation)
```

---

## Palier 6 — Coque administration

**Livrable :** layout admin, menu dynamique selon permissions, tableau de bord vide ou indicateurs mock.

### Prérequis

- Palier 5.

### Pas à pas

1. Layout `/admin` : sidebar, en-tête, déconnexion.
2. Construire le menu à partir de la liste des permissions de l’utilisateur connecté (cf. routes ARCHITECTURE § découpage frontend).
3. Routes protégées : redirection `/login` si non authentifié.
4. Page tableau de bord : structure prête pour palier 18 (cartes vides ou « à venir »).
5. Composants partagés : table paginée, formulaire, toasts d’erreur API.

### Preuve de fin

- Connexion en super admin voit tout le menu ; connexion en caissier n’accède pas à `/admin` (ou voit uniquement ce qui est autorisé si vous ouvrez un profil hybride — par défaut caissier → `/pos`).

### Tests

- Tests manuels ou e2e : entrées de menu présentes / absentes selon rôle.

### Réalisation (2026-11-18)

- Configuration `admin-nav.ts` (zones ARCHITECTURE) : entrées affichées si au moins une permission correspondante.
- `RequireAdminAccess` : rôle `CASHIER` redirigé vers `/pos` ; autres profils admin sur `/admin`.
- `AdminLayout` : sidebar groupée, menu mobile (tiroir), en-tête contextuel, raccourci caisse.
- Tableau de bord : structure posée ici (santé API, raccourcis). Les KPI métier réels (`GET /dashboard`, Recharts) sont branchés au palier 18.
- Routes `/admin/preview/:section` protégées par permission ; pages « module à venir » élégantes.
- Composants partagés : `PageHeader`, `Alert`, `FormField` / `FormSection`, `DataTable`, `Pagination`, `Toast`, `Button`.
- Écran utilisateurs refactoré sur la bibliothèque commune ; toasts pour succès / erreurs API.

```text
Palier n° : 6
Date : 2026-11-18
Validé par : —
Résumé des livrables : coque admin, navigation par permissions, dashboard prêt, UI partagée
Tests exécutés : build frontend ; tests manuels menu (super admin vs caissier)
Écarts par rapport à ARCHITECTURE : écran rôles/permissions en aperçu uniquement (livré avec pilotage)
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (attendre validation)
```

---

## Palier 7 — Boutiques, entrepôt, caisses

**Livrable :** CRUD boutiques, fiche entrepôt (seed), caisses par boutique.

### Prérequis

- Paliers 5, 6.

### Pas à pas

1. Modules `stores`, `warehouses`, `cash_registers`.
2. CRUD boutique : code unique, statut, en-tête / pied de ticket.
3. Entrepôt : lecture + mise à jour fiche (un entrepôt exploité en v1).
4. Caisse : une caisse par défaut par boutique (`is_default`), code unique par boutique.
5. UI admin : Réseau → boutiques, entrepôt, caisses.
6. Audit log sur création / modification (si module audit stub existe, sinon journal minimal temporaire).

### Preuve de fin

- Création boutique + caisse par défaut ; contrainte d’unicité `(store_id, code)` respectée.

### Tests

- CRUD API + tests service sur unicité et statuts.

### Réalisation (2026-11-18)

- Modules `stores`, `warehouses`, `cash-registers` ; journal `audit-logs` (écriture seule, lecture au palier 20).
- Création boutique : code unique normalisé, caisse par défaut `C01` dans la même transaction, audit `STORE_CREATED`.
- Entrepôt : lecture + mise à jour fiche (code `CENTRAL` immuable) ; refus de désactiver le dernier entrepôt actif.
- Caisses : unicité `(store_id, code)` ; une seule `is_default` par boutique (index unique partiel SQL + service) ; la caisse par défaut reste active.
- UI admin : `/admin/stores`, `/admin/warehouse`, `/admin/cash-registers` — cartes réseau, aperçu ticket 80 mm, caisses groupées.
- Permissions : `stores.manage` pour écriture ; lecture entrepôt aussi avec `stock.read`.
- Migration `20261118170000_cash_register_one_default`.

```text
Palier n° : 7
Date : 2026-11-18
Validé par : —
Résumé des livrables : CRUD boutiques, fiche entrepôt, caisses par boutique, audit création/modification
Tests exécutés : jest unitaire (stores, cash-registers, warehouses), e2e network, test:constraints, build
Écarts par rapport à ARCHITECTURE : GET /stores/options pour l’affectation utilisateurs (liste compacte) ; index unique partiel une caisse par défaut
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (attendre validation)
```

---

## Palier 8 — Catégories et produits

**Statut : validé le 2026-11-19.**

**Livrable :** arbre catégories (profondeur max 2), fiche produit centrale, **sans** encore prix historisés complets si palier 9 suit immédiatement — mais champs produit créés.

### Prérequis

- Palier 7.

### Pas à pas

1. Module `categories` : parent/enfant, slug, archivage si produits actifs liés.
2. Module `products` : création centrale seule, référence unique, statuts `DRAFT` → `ACTIVE`, photo (chemin fichier, upload basique ou placeholder).
3. **Pas** de lignes `product_stores` automatiques à la création.
4. UI : liste / fiche produit, arborescence catégories.

### Preuve de fin

- Produit créé uniquement par profil autorisé ; caissier en lecture catalogue autorisé seulement.

### Tests

- Profondeur catégorie > 2 refusée ; référence dupliquée refusée.

### Réalisation (2026-11-18, complété 2026-11-19)

- Modules `categories` et `products` ; journal `audit_logs` sur création / modification / photo / autorisations boutiques.
- Arbre à **deux niveaux** (famille / feuille). Un troisième niveau est refusé (`CATEGORY_DEPTH_EXCEEDED`). Slug unique dérivé du libellé. Archivage si des produits sont liés ; suppression seulement si le nœud est vide.
- Produit créé **en brouillon**, référence unique normalisée, classement obligatoire sur un nœud feuille actif. Statuts `DRAFT` → `ACTIVE` → `INACTIVE` / `ARCHIVED`.
- Champs tarifaires de la fiche (`purchase_price`, `official_price`, `discount_percent`, cache `final_price`) remplis dès la création. **Pas** d’historique `product_prices` / `product_discounts` (palier 9). **Aucune** ligne `product_stores` à la création.
- Autorisation boutique : cases à cocher sur la fiche (`PUT /products/:id/stores`). Retirer une autorisation met `is_authorized = false` et ne touche pas au stock. Seules les boutiques actives peuvent être nouvellement ouvertes.
- Photo : upload JPEG/PNG/WebP ≤ 2 Mo, stockage `uploads/products/`, lecture `/uploads/`.
- Permissions : écriture `products.manage` ; lecture `products.read`. Le caissier lit uniquement les articles **actifs et autorisés** dans ses boutiques affectées.
- UI admin : `/admin/categories` (arbre + inspecteur), `/admin/products` (grille visuels + filtres), `/admin/products/:id` (fiche, dropzone, aperçu prix, boutiques autorisées).

```text
Palier n° : 8
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : arbre catégories profondeur 2, CRUD produits central, photo, autorisation boutiques, pas de product_stores auto
Tests exécutés : jest unitaire products 8/8 ; e2e catalog 5/5 (dont caissier catalogue autorisé)
Écarts par rapport à ARCHITECTURE : tarif cache sur la fiche sans historisation (prévu palier 9) ; upload photo local (pas encore /uploads/ Nginx prod)
Décision : [x] Validé  [ ] À corriger
Palier suivant autorisé : oui (palier 9 — prix et remises, historique)
```

---

## Palier 9 — Prix, remises, historique

**Statut : validé le 2026-11-19.**

**Livrable :** formule officielle, historique `product_prices` / `product_discounts`, cache `products.final_price`.

### Prérequis

- Palier 8.

### Pas à pas

1. Modules `pricing`, `discounts` ; utilitaire `common/money` (arrondi half-up, échelles USD/CDF).
2. À la création produit (transaction unique) : première ligne prix ouverte + remise ouverte + cache.
3. Modification : clôturer ligne ouverte (`valid_to`), insérer nouvelle ligne, recalculer cache, `audit_logs`, notification si changement (hors création).
4. Exposer lecture admin ; **aucune** route caissier pour modifier prix/remise.
5. Tests unitaires sur la formule (ex. 50 USD, 20 % → 40.00).

### Preuve de fin

- Tests automatisés : formule + une seule ligne ouverte par produit + historique conservé.

### Tests

- Cas cahier : remise 0 %, 20 %, 100 % (prix final nul).

### Réalisation (2026-11-19)

- **`common/money`** : arrondi half-up USD (2 déc.) et CDF (0 déc.), `computeFinalPrice`, `computeDiscountAmount`.
- Modules **`pricing`** (`GET overview` + recherche, `GET timeline`, `PATCH prices`) et **`discounts`** (`PATCH remise`).
- **`PricingLedgerService`** : ouverture à la création produit, clôture + insertion, cache `products`, audit `PRODUCT_PRICE_UPDATED` / `PRODUCT_DISCOUNT_UPDATED`, notifications `PRICE_CHANGED` / `DISCOUNT_CHANGED` (paramètres seed), hors création.
- Permissions : `prices.update`, `discounts.update` ; caissier **403** sur écriture tarif ; `PATCH /products` avec tarif exige les permissions dédiées.
- **Rétro-remplissage** : `npm run prisma:backfill-pricing` pour produits créés avant le palier 9 sans lignes ouvertes.
- **UI** : `/admin/pricing` (liste, recherche référence/nom/marque, édition prix/remise, historique archivé par période) ; fiche produit : tarif initial à la création puis lecture + lien vers Prix & remises (pas d’historique sur la fiche).
- Tests : `money.spec` **3/3** ; `products.service.spec` **8/8** ; e2e `pricing` **7/7** ; e2e `catalog` **5/5** (lignes ouvertes à la création).

```text
Palier n° : 9
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : formule officielle, historique product_prices / product_discounts, cache final_price, API admin, UI Prix & remises, backfill, notifications sur modification
Tests exécutés : jest money 3/3 ; products.service 8/8 ; e2e pricing 7/7 ; e2e catalog 5/5
Écarts par rapport à ARCHITECTURE : CDF dans money utilitaire seulement (tarif produit reste USD) ; centre de notifications non affiché (création seule, lecture palier 19+)
Décision : [x] Validé  [ ] À corriger
Palier suivant autorisé : oui (palier 10 — codes-barres, impression)
Recette manuelle (2026-11-19) :
  [x] Créer article → une ligne prix ouverte + une remise ouverte
  [x] Modifier prix et remise → anciennes périodes visibles dans historique archivé
  [x] Recherche article sur Prix & remises
  [x] Backfill documenté (`npm run prisma:backfill-pricing`) si besoin sur bases existantes
```

---

## Palier 10 — Codes-barres Code 128, impression, journal

**Livrable :** un code actif par produit, impression, `barcode_print_logs`.

### Prérequis

- Paliers 8, 9.

### Pas à pas

1. Module `barcodes` : génération Code 128, unicité `code`, un produit = un code actif.
2. Réimpression : journalise sans régénérer un nouveau code.
3. Recherche par code (préparation caisse).
4. UI admin : génération, impression navigateur (`window.print`), lot optionnel.
5. Permission `barcodes.print` respectée.

### Preuve de fin

- Unicité garantie ; journal contient auteur, copies, contexte.

### Tests

- Deux produits ne peuvent pas partager le même code ; réimpression loggée.

### Réalisation (2026-11-19)

- Module **`barcodes`** : génération Code 128 (`EY` + 6 chiffres, subset B), unicité `code` et un code actif par produit (`product_id` unique).
- Attribution automatique à la **création produit** ; `POST /barcodes/products/:id` idempotent (ne régénère jamais) ; `POST /barcodes/missing` pour le rétro-remplissage applicatif.
- **Recherche** `GET /barcodes/lookup?code=` (préparation caisse, périmètre caissier respecté) ; liste admin filtrable (codés / sans code, recherche référence/nom/marque/code).
- **Impression** `POST /barcodes/print` : journal `barcode_print_logs` (auteur, copies, `SINGLE` / `BATCH`) sans émettre un nouveau code ; UI `window.print` (étiquettes A4, pas d’agent silencieux).
- Permissions : génération `products.manage` ; impression et journal `barcodes.print` ; caissier **403** sur l’impression.
- **UI** : `/admin/barcodes` (atelier étiquettes + journal), prévisualisation Code 128 sur fiche produit, lien depuis le catalogue.
- Rétro-remplissage : `npm run prisma:backfill-barcodes`.
- Tests : `barcode-code` **4/4** ; `barcodes.service` **5/5** ; e2e `barcodes` **5/5**.

```text
Palier n° : 10
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : un Code 128 actif par produit, impression navigateur unitaire/lot, journal barcode_print_logs, lookup caisse, UI atelier
Tests exécutés : jest barcode-code 4/4 ; barcodes.service 5/5 ; e2e barcodes 5/5
Écarts par rapport à ARCHITECTURE : payload interne EY+6 chiffres (pas de GS1) ; PDF serveur reporté (T6 : window.print en v1)
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle (2026-11-19) :
  [ ] Créer article → un code Code 128 unique
  [ ] Deux articles → codes distincts ; unicité SQL
  [ ] Réimprimer → même code, ligne de journal (auteur, copies, contexte)
  [ ] Lot → contexte BATCH
  [ ] Caissier : lookup OK si autorisé, impression 403
```

---

## Palier 11 — Fournisseurs et réceptions

**Livrable :** brouillon → validation réception → **un seul** incrément stock entrepôt.

### Prérequis

- Paliers 8, 12 (module `StockMovementsService` minimal requis — voir note ci-dessous).

**Note d’ordre :** le tableau global place le palier 11 avant 12. En pratique, implémenter d’abord le **squelette** de `StockMovementsService` (écriture `stock_levels` + `stock_movements`) dans le palier 11 ou fusionner 11/12 en une seule validation si nécessaire. La preuve exige : validation réception n’incrémente qu’une fois.

### Pas à pas

1. Modules `suppliers`, réceptions `goods_receipts` / `goods_receipt_items`.
2. Workflow : `DRAFT` → `VALIDATED` dans une transaction : mouvement `GOODS_RECEIPT`, mise à jour solde entrepôt, coût ligne conservé.
3. Pas de mise à jour automatique du prix d’achat catalogue sans action explicite admin.
4. UI : fournisseurs, saisie réception, validation.

### Preuve de fin

- Test : quantité X validée → solde entrepôt +X une seule fois ; annulation si prévue par le modèle.

### Tests

- Double validation impossible ; stock cohérent avec mouvement.

### Réalisation (2026-11-19)

- **`StockMovementsService` minimal** : seul écrivain de `stock_levels` / `stock_movements` pour `GOODS_RECEIPT` (direction `IN`, `FOR UPDATE` sur la ligne entrepôt, `source_type` `goods_receipt`).
- **`DocumentSequenceService`** : références `RC######` via `document_sequences`.
- Module **`suppliers`** : CRUD fournisseurs (`suppliers.manage` / `suppliers.read`), options actives pour la saisie.
- Module **`goods-receipts`** : brouillon (`DRAFT`) → validation transactionnelle (`VALIDATED`) ou annulation brouillon (`CANCELLED`) ; lignes `goods_receipt_items` avec coût conservé sur le mouvement **sans** mise à jour du `purchase_price` catalogue.
- Permissions : saisie `suppliers.manage` ; validation `receipts.validate` (staff lecture seule → **403** sur validate).
- **UI** : `/admin/suppliers`, `/admin/goods-receipts` (liste, fiche, validation avec confirmation).
- Tests : `document-sequence` **1/1** ; e2e `suppliers` **3/3** (stock +X une fois, double validation **409**, prix catalogue inchangé).

```text
Palier n° : 11
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : fournisseurs, réceptions brouillon→validées, StockMovementsService GOODS_RECEIPT, UI admin
Tests exécutés : document-sequence 1/1 ; e2e suppliers 3/3
Écarts par rapport à ARCHITECTURE : squelette stock (lecture soldes / alertes au palier 12) ; annulation validée hors périmètre v1
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle (2026-11-19) :
  [ ] Créer fournisseur actif
  [ ] Réception brouillon avec lignes (coût ≠ prix catalogue)
  [ ] Valider → solde entrepôt + quantité, mouvement GOODS_RECEIPT
  [ ] Re-valider → 409, stock inchangé
  [ ] Prix d’achat fiche produit inchangé
```

---

## Palier 12 — Soldes, mouvements, alertes

**Livrable :** `StockMovementsService` unique écrivain de `stock_levels`, alertes seuil, zéro rupture.

### Prérequis

- Palier 8 (produits), palier 2.

### Pas à pas

1. Module `stock-movements` : lecture soldes par lieu, grand livre append-only.
2. `SELECT … FOR UPDATE` sur les écritures prévues (préparation ventes / transferts).
3. Seuil : comparaison `quantity_on_hand` vs seuil produit ou défaut global ; notifications `LOW_STOCK` / `STOCKOUT` **sans** bloquer la vente.
4. API lecture admin + filtre boutique / entrepôt selon permission.
5. Service de réconciliation (super admin) : comparer solde vs somme mouvements — lecture seule, journalise écart.

### Preuve de fin

- Aucun autre module n’écrit directement `stock_levels`.
- `quantity_on_hand >= 0` toujours vrai.

### Tests

- Mouvement IN/OUT ; alerte déclenchée au franchissement du seuil.

### Développement (2026-11-19)

- **`StockMovementsService` complet** : `recordMovement`, verrou `FOR UPDATE` entrepôt/boutique, refus stock négatif (`INSUFFICIENT_STOCK`), alertes `LOW_STOCK` / `STOCKOUT` après écriture.
- **API** : `GET /stock/summary`, `GET /stock/levels`, `GET /stock/movements`, `POST /stock/manual-adjustments` (`stock.adjust`), `POST /stock/reconcile` (super admin, audit lecture seule).
- **Périmètre** : filtre boutique selon affectation ; gestionnaire entrepôt = soldes entrepôt ; `@StoreScoped` sur requêtes boutique.
- **UI** : `/admin/stock` — KPI alertes, onglets soldes / grand livre, ajustement manuel, réconciliation.
- **Tests** : e2e `stock.e2e-spec.ts` (IN/OUT, alertes, refus stock, summary/mouvements/filtre LOW, réconciliation super admin).
- **UI** : sélecteur produit catalogue pour ajustement manuel (plus de saisie UUID seule).

```text
Palier n° : 12
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : StockMovementsService écrivain unique étendu, lecture admin, alertes, réconciliation, UI soldes/mouvements
Tests exécutés : e2e stock 4/4
Écarts par rapport à ARCHITECTURE : deleteMany stock_levels à la suppression produit/boutique (nettoyage référentiel, hors mouvements métier) — inchangé
Décision : [x] Validé  [ ] À corriger
Palier suivant autorisé : oui (palier 13 — transferts)
Recette manuelle :
  [x] Soldes entrepôt via GET /stock/levels (+ réceptions palier 11, couvert e2e ajustements)
  [x] Ajustement IN/OUT avec justification (stock.adjust)
  [x] Franchissement seuil → LOW_STOCK ; rupture → STOCKOUT (e2e)
  [x] Réconciliation super admin journalise sans corriger (e2e)
```

---

## Palier 13 — Transferts et écarts

**Statut : développé le 2026-11-19 — en attente de validation.**

**Livrable :** cycle complet entrepôt → boutique, réservation, expédition, réception partielle ou totale.

### Prérequis

- Paliers 12, 7, autorisation `product_stores`.

### Pas à pas

1. Module `transfers` : machine à états (ARCHITECTURE §3.5).
2. Création : produits **déjà autorisés** dans la boutique destinataire.
3. Validation : `quantity_reserved` à l’entrepôt.
4. Expédition : sortie physique + libération réservation.
5. Réception : entrée boutique = quantité reçue ; écart expédié/reçu → notification, pas de retour silencieux à l’entrepôt.
6. UI admin : liste, détail, actions par étape selon permissions.

### Preuve de fin

- Scénario intégration : demande → validé → expédié → reçu avec écart négatif signalé.

### Tests

- Transfert vers boutique non autorisée refusé ; annulation avant expédition libère la réservation.

### Développement (2026-11-19)

- **Module `transfers`** : machine à états `DRAFT → PENDING → VALIDATED → PREPARING → SHIPPED → (PARTIALLY_RECEIVED) → RECEIVED`, annulation jusqu’à `PREPARING`.
- **Stock** : validation = `quantity_reserved` entrepôt ; expédition = `TRANSFER_OUT` + libération réservation ; réception = `TRANSFER_IN` boutique de la quantité reçue uniquement. Écart négatif notifié (`TRANSFER_RECEIVED` WARNING), jamais de retour silencieux.
- **Autorisation** : un produit non autorisé dans la boutique destinataire est refusé (`TRANSFER_PRODUCT_NOT_AUTHORIZED`).
- **API** : `GET/POST /transfers`, catalogue autorisé, soumission, validation, préparation, expédition, réception, annulation. Permissions `transfers.create|validate|prepare_ship|receive`, périmètre boutique.
- **UI** : `/admin/transfers` — KPI, filtre par étape, fiche avec timeline, actions contextuelles, saisie d’écart à la réception.
- **Tests** : e2e `transfers.e2e-spec.ts` (non autorisé, libération réservation, cycle avec écart −3 signalé).

```text
Palier n° : 13
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : cycle transfert entrepôt→boutique, réservation, expédition, réception avec écart notifié, UI admin
Tests exécutés : e2e transfers 3/3
Écarts par rapport à ARCHITECTURE : néant
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle :
  [ ] Créer un transfert vers boutique autorisée
  [ ] Soumettre → valider (réservation entrepôt)
  [ ] Préparer → expédier (sortie physique)
  [ ] Réceptionner moins que l’expédié → notification d’écart, stock boutique = reçu
  [ ] Transfert produit non autorisé → refusé
  [ ] Annulation avant expédition → réservation libérée
```

---

## Palier 14 — Sorties internes

**Statut : développé le 2026-11-19 — en attente de validation.**

**Livrable :** demande → approbation ; stock inchangé tant que non approuvé.

### Prérequis

- Palier 12.

### Pas à pas

1. Module `internal-issues` : statuts, motifs (`reason_code`).
2. Approbation : transaction unique → mouvement `INTERNAL_ISSUE`, baisse physique.
3. Notifications « à valider » pour les profils concernés.
4. UI : liste, demande, validation/rejet.

### Preuve de fin

- Brouillon n’affecte pas `quantity_on_hand` ; approuvé oui.

### Tests

- Rejet et annulation ne modifient pas le stock.

### Réalisation (2026-11-19)

- Module **`internal-issues`** : API `/internal-issues` (CRUD brouillon, soumission, confirmation boutique, approbation, rejet, annulation).
- Mouvement `INTERNAL_ISSUE` via `StockMovementsService.recordInternalIssue` **uniquement à l’approbation** ; brouillon / attente / rejet / annulation n’écrivent pas `stock_levels`.
- Notification `INTERNAL_ISSUE_PENDING` à la soumission. Confirmation caisse (`INTERNAL_ISSUE_STORE_CONFIRMED`) avant validation centrale si `stock.internal_issue_requires_store_confirmation`.
- Permissions : `internal_issues.request` (saisie) ; `internal_issues.validate` (approbation / rejet).
- **UI admin** : `/admin/internal-issues` — KPI, catalogue par lieu, frise Brouillon → Attente → Approuvé.
- **UI caisse** : `/pos/internal-issues` — confirmation boutique des demandes en attente.
- Tests : e2e `internal-issues.e2e-spec.ts` **2/2** (brouillon/attente sans impact ; approbation −5 ; rejet et annulation inchangés).

```text
Palier n° : 14
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : sorties internes, INTERNAL_ISSUE à l’approbation seule, notifications, UI admin + confirmation POS
Tests exécutés : e2e internal-issues 2/2
Écarts par rapport à ARCHITECTURE : confirmation boutique en caisse (paramètre stock.internal_issue_requires_store_confirmation) avant validation centrale
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle :
  [ ] Créer une demande brouillon → stock inchangé
  [ ] Soumettre → notification « à valider »
  [ ] Approuver → solde − quantité, mouvement INTERNAL_ISSUE
  [ ] Rejeter / annuler → stock inchangé
```

---

## Palier 15 — Caisse et ventes

**Statut : développé le 2026-11-19 — en attente de validation.**

**Livrable :** session ouverte, vente transactionnelle, idempotence, concurrence dernière pièce.

### Prérequis

- Paliers 9, 12, 7, 4, 5.

### Pas à pas — Backend

1. Modules `cash-registers` (sessions), `pos`, `sales` : une session `OPEN` par caisse.
2. `POST /api/v1/sales` : corps = produit + quantité (+ paiements si palier 16 couplé) ; **ignorer** prix client.
3. Transaction : vérifier session, `product_stores`, prix/remise ouverts, `FOR UPDATE` stock boutique, snapshots sur `sale_items`.
4. `Idempotency-Key` obligatoire ; stockage hash unique en base.
5. Annulation vente (`VOIDED`) : mouvement inverse stock (permission `sales.void`).

### Pas à pas — Frontend

1. UI `/pos` : plein écran, focus scanner, panier, validation, impression ticket (layout 80 mm).

### Preuve de fin

- Deux ventes concurrentes sur stock 1 : une réussit, l’autre `INSUFFICIENT_STOCK`.
- Double soumission même clé idempotence → une seule vente.

### Tests

- Concurrence, idempotence, refus produit non autorisé, refus stock.

### Réalisation (2026-11-19)

- Modules **`cash-sessions`**, **`sales`**, **`pos`** ; table `sale_idempotency_keys` ; mouvements `SALE` / `SALE_REVERSAL` via `StockMovementsService`.
- **Session** : une seule `OPEN` par caisse ; `POST /cash-sessions/open`, `GET /cash-sessions/current`, `GET /cash-sessions`, `GET /cash-sessions/:id`, `POST /cash-sessions/:id/close` (compté vs théorique, écart journalisé).
- **Vente** : `POST /sales` avec `Idempotency-Key` obligatoire ; le serveur relit prix/remise ouverts, `product_stores` et stock boutique (`FOR UPDATE`) — **aucun prix client n’est retenu**. Snapshots sur `sale_items`. `POST /sales/:id/void` (`sales.void`) → mouvement inverse.
- **POS** : `/pos` plein écran (session, scan, panier, validation, ticket 80 mm). Écrans caisse complémentaires posés ensuite : réception transfert, confirmation dépenses tiroir, confirmation sorties internes.
- **Admin** : `/admin/sales` (journal), `/admin/cash-sessions` (situation / clôture).
- Tests : e2e `sales.e2e-spec.ts` **4/4** (Idempotency-Key obligatoire, produit non autorisé, concurrence dernière pièce, rejeu de clé).

```text
Palier n° : 15
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : session de caisse, vente transactionnelle, idempotence, void, UI POS + supervision admin
Tests exécutés : e2e sales 4/4
Écarts par rapport à ARCHITECTURE : clôture et supervision admin livrées dans le même palier ; paiements exigés dès POST /sales (couplé palier 16)
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle :
  [ ] Ouvrir une session (fond USD/CDF)
  [ ] Vente scannée → ticket 80 mm, stock boutique − quantité
  [ ] Double envoi même clé → une seule vente
  [ ] Deux caisses concurrentes sur stock 1 → une INSUFFICIENT_STOCK
  [ ] Annuler une vente (sales.void) → stock rétabli
```

---

## Palier 16 — Paiements, devises, taux

**Statut : développé le 2026-11-19 — en attente de validation.**

**Livrable :** paiement mixte, snapshot taux, référence Mobile Money saisie à la main.

### Prérequis

- Palier 15.

### Pas à pas

1. Modules `payments`, `exchange-rates` : taux encaissement / décaissement, une ligne ouverte par type.
2. Lors de la vente : plusieurs lignes `payments` ; somme `amount_usd` = total vente dans la même transaction.
3. Conversion CDF ↔ USD avec taux encaissement figé sur la ligne.
4. Référence obligatoire pour M-Pesa, Orange Money, Airtel Money.
5. UI caisse : sélection moyens, saisie références, affichage reste à payer.

### Preuve de fin

- Vente 100 USD payée 50 cash USD + reste CDF au taux du jour → équilibre exact.

### Tests

- Déséquilibre paiements → rollback ; taux historisé via snapshot.

### Réalisation (2026-11-19)

- Modules **`payments`** et **`exchange-rates`** : une ligne de taux ouverte par type (`ENCAISSEMENT` / `DECAISSEMENT`) ; `POST /exchange-rates/pair` + `PATCH /exchange-rates` (historique, `EXCHANGE_RATE_UPDATED`).
- **Vente** : plusieurs lignes `payments` dans la même transaction ; somme `amount_usd` = total ; conversion CDF au taux d’encaissement **figé** sur la ligne. Référence obligatoire pour M-Pesa, Orange Money, Airtel Money. Déséquilibre → rollback.
- **UI caisse** : encaissement mixte, reste à payer, saisie des références Mobile Money.
- **UI admin** : `/admin/exchange-rates` (taux courants + révisions), `/admin/payments` (journal des lignes figées).
- Tests : e2e `payments.e2e-spec.ts` **2/2** (déséquilibre refusé ; 100 USD = 50 cash USD + reliquat CDF au taux du jour).

```text
Palier n° : 16
Date : 2026-11-19
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : paiements mixtes, snapshot taux, références Mobile Money, UI POS + admin
Tests exécutés : e2e payments 2/2
Écarts par rapport à ARCHITECTURE : néant majeur (taux décaissement utilisé ensuite au palier 17)
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle :
  [ ] Vente mixte USD + CDF → équilibre exact, taux figé
  [ ] Paiement Mobile Money sans référence → refusé
  [ ] Déséquilibre paiements → pas de vente, stock inchangé
  [ ] Modifier le taux → historique conservé, ventes antérieures inchangées
```

---

## Palier 17 — Dépenses

**Statut : développé le 2026-11-25 — en attente de validation.**

**Livrable :** dépenses USD/CDF, impact solde théorique caisse espèces si session ouverte.

### Prérequis

- Paliers 15, 16.

### Pas à pas

1. Module `expenses` : lieu boutique ou entrepôt, pièce jointe (`receipt_path`).
2. Lien optionnel `cash_session_id` : dépense espèces pendant session ouverte réduit le théorique espèces.
3. Mobile Money des ventes reste hors tiroir (pas d’écart espèces).
4. UI admin / caisse selon permissions `expenses.manage`.

### Preuve de fin

- Clôture caisse : `attendu = fond + espèces ventes − espèces dépenses` cohérent avec scénario test.

### Tests

- Dépense rattachée session vs hors session.

### Réalisation (2026-11-25)

- Module **`expenses`** : numérotation `DP######`, site exclusif boutique **ou** entrepôt, catégories normalisées, audit `EXPENSE_CREATED`.
- **Tiroir** : `fromCashDrawer` + `cash_session_id` (session ouverte, même boutique). Solde théorique dynamique : `attendu = fond + espèces encaissées − dépenses tiroir` (par devise). Hors tiroir : pas d’impact espèces. Mobile Money des ventes reste hors tiroir.
- **Confirmation caisse** : statut `PENDING_CASHIER_CONFIRMATION` → `POST /expenses/:id/confirm-cashier` (`cash.session`) ; notification `EXPENSE_DRAWER_PENDING` ; clôture de session refusée tant qu’une confirmation est en attente.
- **Justificatifs** : upload JPEG/PNG/WebP/PDF (5 Mo) → `uploads/expenses/` (`POST /expenses/:id/receipt`).
- Permissions : saisie `expenses.manage` ; lecture aussi `reports.read`.
- **UI** : `/admin/expenses` (journal, KPI, filtres, création, justificatif) ; `/pos/expenses` (confirmation caissier).
- Tests : e2e `expenses.e2e-spec.ts` **2/2** (tiroir −15 USD sur théorique ; hors tiroir sans impact).

```text
Palier n° : 17
Date : 2026-11-25
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : dépenses USD/CDF, impact tiroir, justificatifs, confirmation caisse, UI admin + POS
Tests exécutés : e2e expenses 2/2
Écarts par rapport à ARCHITECTURE : confirmation caissier des dépenses tiroir (workflow POS) avant impact définitif / clôture
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle :
  [ ] Dépense tiroir sur session ouverte → théorique espèces réduit
  [ ] Dépense hors tiroir → théorique inchangé
  [ ] Justificatif joint (image ou PDF)
  [ ] Clôture : attendu = fond + espèces ventes − espèces dépenses
```

---

## Palier 18 — Rapports et exports

**Statut : développé le 2026-11-25 — en attente de validation.**

**Livrable :** agrégats SQL, graphiques Recharts, export Excel (ExcelJS) et PDF (PDFKit).

### Prérequis

- Données issues des paliers 11–17 (jeux de test seed ou script de charge).

### Pas à pas

1. Module `reports` : lecture seule, pas d’écriture métier.
2. Rapports couvrant au minimum : ventes par période/boutique, stock valorisé (qté × prix d’achat catalogue), marges, mouvements, transferts en cours, écarts caisse.
3. Exports sur jeux de données **connus** (fichiers golden en test).
4. UI : pages `/admin/reports`, filtres date/boutique, graphiques.

### Preuve de fin

- Export PDF et Excel sur jeu fixe → hash ou snapshot comparé en test.

### Tests

- Cohérence agrégats vs requêtes SQL de contrôle.

### Réalisation (2026-11-25)

- Module **`reports`** lecture seule : `GET /reports/overview` (période, boutique) — CA, coût, marge, remises, dépenses, résultat net, encaissements par devise/moyen, CA par boutique, top produits, stock valorisé (qté × prix d’achat catalogue), écarts de clôture, ventes récentes.
- Module **`dashboard`** : `GET /dashboard` alimente le tableau de bord admin (KPI réels, graphiques Recharts) à la place des cartes mock du palier 6.
- **UI** : `/admin/reports` — filtres période/boutique, graphiques Recharts, hub vers les journaux opérationnels (ventes, sessions, encaissements, stock, transferts, etc.).
- **Export** : Excel (ExcelJS) et PDF serveur (`pdf-lib`, écart mineur vs PDFKit T8 — incompatibilité ESM Jest/Windows) via `GET /reports/export/sales.xlsx`, `stocks.xlsx`, `overview.pdf` ; CSV navigateur conservé en complément.
- Tests : e2e `reports.e2e-spec.ts` (overview, exports MIME + signatures).

```text
Palier n° : 18
Date : 2026-11-25
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : agrégats SQL, tableau de bord réel, Recharts, export CSV, hub /admin/reports
Tests exécutés : e2e reports (overview + exports)
Écarts par rapport à ARCHITECTURE : pas de golden files hash figés (métadonnées Excel variables) ; le hub rapports pointe encore vers /admin/inventories (module hors plan de ce guide)
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle :
  [ ] Filtrer par période et boutique → totaux cohérents avec les journaux
  [ ] Stock valorisé = quantité × prix d’achat catalogue
  [ ] Export CSV ventes et stocks
  [ ] Tableau de bord /admin : KPI alignés sur la même période
```

---

## Palier 19 — Paramètres et historique

**Statut : développé le 2026-11-25 — en attente de validation.**

**Livrable :** centre de paramètres, refus caissier sur clés critiques, audit des changements.

### Prérequis

- Paliers 5, 18 (navigation).

### Pas à pas

1. Module `settings` : lecture/écriture `app_settings`, validation schéma JSON par clé, `is_critical`.
2. Seed complet des groupes §11 (commercial, stock, sécurité, notifications, techniques).
3. `SettingsService` : audit ancienne/nouvelle valeur ; notification si clé surveillée.
4. Caissier : pas de `settings.update` ; super admin seul sur `settings.update_critical`.
5. UI : groupes paramètres, historique visible admin (via `audit_logs` ou vue dédiée).

### Preuve de fin

- Tentative caissier de modifier taux ou seuil critique → 403.
- Modification taux encaissement → audit + notification (si activée).

### Tests

- Clé inconnue refusée ; clé critique protégée.

### Réalisation (2026-11-25)

- Module **`settings`** : `GET /settings`, `PATCH /settings` (lot de clés). Validation par `valueType` ; clé inconnue → `SETTINGS_UNKNOWN_KEY` ; `stock.block_when_insufficient` en lecture seule.
- Seed : groupes `commercial`, `stock`, `security`, `cash`, `notifications`, `technical` (ARCHITECTURE §11).
- Permissions : `settings.update` (clés non critiques) ; `settings.update_critical` (super admin). Caissier sans ces permissions → 403.
- Audit `SETTING_UPDATED` (ancienne / nouvelle valeur) à chaque changement.
- **UI** : `/admin/settings` (groupes, libellés, enregistrement tracé).
- Tests : e2e `settings.e2e-spec.ts` (403 caissier, clé inconnue, audit SETTING_UPDATED).

```text
Palier n° : 19
Date : 2026-11-25
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : centre de paramètres, clés critiques, audit SETTING_UPDATED, UI /admin/settings
Tests exécutés : e2e settings 4 scénarios
Écarts par rapport à ARCHITECTURE : pas de notification métier à la modification d’une clé surveillée (audit seul) ; historique via journal d’audit palier 20 plutôt que vue dédiée ; e2e clé critique super admin non couvert
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (en attente de validation)
Recette manuelle :
  [ ] Caissier : pas d’accès /admin/settings
  [ ] Modifier une clé non critique → audit
  [ ] Clé critique sans settings.update_critical → 403
  [ ] Clé inconnue → 400
```

---

## Palier 20 — Audit, sauvegardes, durcissement VPS

**Statut : développé (application) le 2026-11-25 — VPS / sauvegardes non commencés — en attente de validation.**

**Livrable :** exploitation production sur Ubuntu 24.04 selon ARCHITECTURE §12–13.

### Prérequis

- Paliers 3–19 fonctionnels en staging.

### Pas à pas — Application

1. Module `audit-logs` : lecture filtrée, append-only côté DB.
2. Module `notifications` : liste, marquer lu (si pas déjà fait aux paliers précédents).
3. Vérifier couverture audit : prix, remises, taux, paramètres, transferts, ventes annulées, clôtures avec écart.

### Pas à pas — Serveur

1. Installer Node 22, PostgreSQL 16, Nginx, PM2, Certbot (natif, sans Docker).
2. Utilisateur `eyano`, secrets dans `/etc/eyano/api.env` (hors git).
3. PostgreSQL localhost uniquement ; rôle SQL sans `DELETE` sur journaux/pièces.
4. Nginx : HTTPS, proxy `/api/`, static frontend, `/uploads/` alias.
5. PM2 + systemd au boot ; `deploy.sh` documenté.
6. `ufw` : 22, 80, 443 ; fermer 5432 et 3000 externes.
7. Cron sauvegarde : `backup-postgres.sh`, rétention 30 jours ; `restore-postgres.sh` testé sur base jetable.
8. Archive uploads quotidienne ; fichier `last_success_at` lu par l’écran paramètres.

### Preuve de fin

- Restore test **réussi** documenté (date, opérateur).
- Scan basique : API non exposée sans TLS, cookies refresh sécurisés en prod.

### Tests

- Restauration sur `eyano_test` ; redémarrage VPS → API remonte seule.

### Réalisation (2026-11-25) — application seulement

- **`audit-logs`** : lecture filtrée `GET /audit-logs` (+ `catalog`, `summary`), append-only. Couverture : prix, remises, taux, paramètres, transferts, ventes, void, clôtures, dépenses, sorties internes, réseau, catalogue.
- **`notifications`** : `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`. UI `/admin/notifications` + cloche alertes stock.
- **`login-histories`** : `GET /login-histories` (+ `summary`). UI `/admin/login-history`.
- Tests unitaires : `audit-logs.service.spec.ts`, `login-histories.service.spec.ts`.
- **Serveur / VPS : non commencé.** `deploy/scripts/deploy.sh`, Nginx et PM2 restent le squelette du palier 3. Pas de `backup-postgres.sh` / `restore-postgres.sh`, pas de cron, pas de `last_success_at`, pas de durcissement `ufw` / rôle SQL documenté en runbook.

```text
Palier n° : 20
Date : 2026-11-25
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : lecture audit, centre de notifications, historique des connexions (UI admin)
Tests exécutés : jest audit-logs + login-histories
Écarts par rapport à ARCHITECTURE : partie VPS (Node 22, PostgreSQL 16 durci, Certbot, sauvegardes, restore test) non livrée
Décision : [ ] Validé  [ ] À corriger
Palier suivant autorisé : non (VPS à faire ; validation applicative en attente)
Recette manuelle (application) :
  [ ] Journal d’audit : filtre action / entité, ancienne et nouvelle valeur
  [ ] Notifications : liste, marquer lu, compteur non lus
  [ ] Historique des connexions : succès / échecs
Recette manuelle (VPS) : non applicable tant que le durcissement n’est pas développé
```

---

## Modèle de fiche de validation (par palier)

À copier en fin de chaque cycle (exemple palier 1 archivé ci-dessous).

```text
Palier n° : 1
Date : 2026-11-17
Validé par : Maître d’ouvrage (projet Eyano)
Résumé des livrables : ARCHITECTURE.md — analyse, conception, A1–A18
Tests exécutés : Relecture cahier vs ARCHITECTURE
Écarts par rapport à ARCHITECTURE : aucun signalé
Décision : [x] Validé  [ ] À corriger
Palier suivant autorisé : oui (palier 2)
```

---

## Annexes

- **Décisions métier :** ARCHITECTURE, tableau A1–A18.
- **Choix techniques :** ARCHITECTURE, tableau T1–T12.
- **Matrice permissions :** ARCHITECTURE §6.
- **Hors version 1 :** ne pas implémenter avant arbitrage explicite (Docker, vente en ligne, API Mobile Money, multi-société, sessions d’inventaire physique — cf. ARCHITECTURE).
- **Inventaire dans le code :** le module `inventory`, l’écran `/admin/inventories` et les e2e `inventory.e2e-spec.ts` existent encore. Ils sont **hors plan des 20 paliers** de ce guide.

---

*Document généré pour le pilotage Eyano. Toute divergence avec le cahier ou ARCHITECTURE doit être tracée dans la fiche de validation du palier concerné.*