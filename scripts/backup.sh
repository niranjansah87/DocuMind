#!/usr/bin/env bash
# DocuMind PostgreSQL & pgvector Database Backup Script
# Creates a compressed, custom-format logical dump (-Fc) with checksum verification and retention pruning.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/documind_backup_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
CONTAINER_NAME="${DB_CONTAINER:-documind-db-1}"
DB_USER="${POSTGRES_USER:-documind}"
DB_NAME="${POSTGRES_DB:-documind}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting DocuMind backup for database '${DB_NAME}'..."

# Verify docker container is running
if ! docker ps --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
  # Fallback to docker compose service name
  CONTAINER_NAME=$(docker compose ps -q db 2>/dev/null || echo "")
  if [ -z "${CONTAINER_NAME}" ]; then
    echo "[ERROR] Database container is not running." >&2
    exit 1
  fi
fi

# Execute pg_dump in custom binary format (-Fc includes pgvector extensions & embeddings)
docker exec "${CONTAINER_NAME}" pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -Fc \
  --blobs \
  --verbose > "${BACKUP_FILE}"

# Verify backup archive structure
if ! docker exec -i "${CONTAINER_NAME}" pg_restore --list < "${BACKUP_FILE}" > /dev/null 2>&1; then
  echo "[ERROR] Backup verification failed: created archive is corrupt." >&2
  rm -f "${BACKUP_FILE}"
  exit 2
fi

# Generate SHA-256 checksum
if command -v sha256sum > /dev/null 2>&1; then
  sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
elif command -v shasum > /dev/null 2>&1; then
  shasum -a 256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
fi

BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "[SUCCESS] Backup created and verified successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Retention policy: Prune backups older than RETENTION_DAYS
echo "[INFO] Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -type f -name "documind_backup_*.dump*" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
echo "[INFO] Retention cleanup complete."

