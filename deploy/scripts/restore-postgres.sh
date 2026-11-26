#!/usr/bin/env bash
# Restauration PostgreSQL Eyano sur une base cible (ex. eyano_test). Usage manuel uniquement.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage : $0 <fichier.sql.gz> [DATABASE_URL_cible]" >&2
  echo "Exemple : DATABASE_URL=postgresql://.../eyano_test $0 /var/lib/eyano/backups/eyano_20261125_020000.sql.gz" >&2
  exit 1
fi

DUMP_FILE="$1"
TARGET_URL="${2:-${DATABASE_URL:-}}"

if [[ -z "${TARGET_URL}" ]]; then
  echo "DATABASE_URL ou second argument requis." >&2
  exit 1
fi

if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "Fichier introuvable : ${DUMP_FILE}" >&2
  exit 1
fi

echo "Restauration de ${DUMP_FILE} vers la base cible…"
gunzip -c "${DUMP_FILE}" | psql "${TARGET_URL}" -v ON_ERROR_STOP=1
echo "Restauration terminée."