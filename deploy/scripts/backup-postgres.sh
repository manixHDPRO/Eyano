#!/usr/bin/env bash
# Sauvegarde PostgreSQL Eyano — à planifier via cron (cf. docs/ARCHITECTURE.md).
set -euo pipefail

BACKUP_DIR="${EYANO_BACKUP_DIR:-/var/lib/eyano/backups}"
STATUS_FILE="${EYANO_BACKUP_STATUS_FILE:-/var/lib/eyano/backups/last_success.json}"
LOG_DIR="${EYANO_LOG_DIR:-/var/log/eyano}"
DATABASE_URL="${DATABASE_URL:-}"

mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
stamp_file="$(date -u +%Y%m%d_%H%M%S)"
dump_name="eyano_${stamp_file}.sql.gz"
dump_path="${BACKUP_DIR}/${dump_name}"
log_file="${LOG_DIR}/backup-postgres.log"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${log_file}"
}

if [[ -z "${DATABASE_URL}" ]]; then
  log "Échec : DATABASE_URL non défini."
  exit 1
fi

log "Démarrage de la sauvegarde → ${dump_path}"

if ! pg_dump "${DATABASE_URL}" | gzip -c > "${dump_path}"; then
  log "Échec pg_dump."
  exit 1
fi

find "${BACKUP_DIR}" -name 'eyano_*.sql.gz' -type f -mtime +30 -delete || true

printf '%s\n' "{\"lastSuccessAt\":\"${timestamp}\",\"lastFile\":\"${dump_name}\"}" > "${STATUS_FILE}"

log "Sauvegarde terminée : ${dump_name}"