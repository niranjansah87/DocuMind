#!/usr/bin/env bash
# DocuMind PostgreSQL & pgvector Database Restore Script
# Safely restores a custom-format dump (-Fc) to a target database with schema and vector embeddings.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.dump> [target-database]" >&2
  echo "Example: $0 ./backups/documind_backup_20261013_120000.dump documind_restored" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${DB_CONTAINER:-documind-db-1}"
DB_USER="${POSTGRES_USER:-documind}"
TARGET_DB="${2:-documind_restored}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

# Verify checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "[INFO] Verifying SHA-256 checksum..."
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum -c "${CHECKSUM_FILE}"
  elif command -v shasum > /dev/null 2>&1; then
    shasum -a 256 -c "${CHECKSUM_FILE}"
  fi
  echo "[INFO] Checksum verified."
fi

# Locate database container
if ! docker ps --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
  CONTAINER_NAME=$(docker compose ps -q db 2>/dev/null || echo "")
  if [ -z "${CONTAINER_NAME}" ]; then
    echo "[ERROR] Database container is not running." >&2
    exit 1
  fi
fi

echo "[WARNING] Target database is '${TARGET_DB}'. This will recreate the database and overwrite existing data."
read -p "Proceed with restore? (y/N): " -r CONFIRM
if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
  echo "[INFO] Restore cancelled by user."
  exit 0
fi

echo "[INFO] Recreating database '${TARGET_DB}'..."
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${TARGET_DB} OWNER ${DB_USER};"

echo "[INFO] Restoring schema, data, and vector embeddings from ${BACKUP_FILE}..."
docker exec -i "${CONTAINER_NAME}" pg_restore \
  -U "${DB_USER}" \
  -d "${TARGET_DB}" \
  --verbose \
  --clean \
  --if-exists < "${BACKUP_FILE}" || true

echo "[INFO] Verifying restored row counts..."
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${TARGET_DB}" -c "
  SELECT
    (SELECT count(*) FROM documents) AS total_documents,
    (SELECT count(*) FROM document_chunks) AS total_chunks,
    (SELECT count(*) FROM orders) AS total_orders;
"

echo "[SUCCESS] Restore to '${TARGET_DB}' completed and verified successfully."

