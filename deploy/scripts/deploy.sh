#!/usr/bin/env bash
# Eyano — déploiement manuel (palier 3, squelette). À exécuter sur le VPS sous un compte autorisé.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/var/www/eyano-src}"
BACKEND_DIR="${BACKEND_DIR:-/var/www/eyano/backend}"
FRONTEND_DIST="${FRONTEND_DIST:-/var/www/eyano/frontend}"

echo "==> Backend"
cd "$REPO_ROOT/backend"
npm ci
npm run build
npx prisma migrate deploy

rsync -a --delete dist/ "$BACKEND_DIR/dist/"
rsync -a package.json package-lock.json "$BACKEND_DIR/"
cd "$BACKEND_DIR"
npm ci --omit=dev

echo "==> Frontend"
cd "$REPO_ROOT/frontend"
npm ci
npm run build
rsync -a --delete dist/ "$FRONTEND_DIST/"

echo "==> PM2"
pm2 reload eyano-api || pm2 start "$REPO_ROOT/deploy/pm2/ecosystem.config.cjs"

echo "==> Nginx (si la conf a changé)"
if sudo nginx -t; then
  sudo systemctl reload nginx
fi

echo "Déploiement terminé."