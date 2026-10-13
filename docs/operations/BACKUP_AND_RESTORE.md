# PostgreSQL & pgvector Backup and Restore Runbook

## 1. Overview & Objectives

DocuMind stores both relational data (documents, chunks, orders, tickets) and high-dimensional vector embeddings (`vector(1536)`) within PostgreSQL. This runbook establishes automated backup procedures, point-in-time recovery workflows, and disaster recovery recovery targets.

- **Recovery Point Objective (RPO):** < 1 hour (daily full snapshots + WAL archiving).
- **Recovery Time Objective (RTO):** < 30 minutes.

---

## 2. Backup Procedures

### 2.1 Automated Full Logical Dump (`pg_dump`)
We use PostgreSQL's custom archive format (`-Fc`), which includes schema definitions, table data, and pgvector embeddings in a compressed, multi-threaded restorable archive:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/documind"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/documind_backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "Starting DocuMind database backup to ${BACKUP_FILE}..."

# Execute pg_dump with custom compressed format
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-documind}" \
  -d "${POSTGRES_DB:-documind}" \
  -Fc \
  --blobs \
  --verbose > "${BACKUP_FILE}"

echo "Backup complete: $(ls -lh "${BACKUP_FILE}")"

# Retain last 14 daily backups, prune older
find "${BACKUP_DIR}" -type f -name "documind_backup_*.dump" -mtime +14 -delete
```

### 2.2 Verifying Backup Integrity
Test that a backup file is structurally valid without restoring into the live database:
```bash
docker compose exec -T db pg_restore --list < "${BACKUP_FILE}" | head -n 20
```

---

## 3. Database Restore Procedures

> [!CAUTION]
> Never restore directly into a live production database while traffic is active. Always restore into an isolated staging database or temporary container first to verify data integrity.

### 3.1 Restoring to a Fresh Database
1. Stop API application traffic:
   ```bash
   docker compose stop api web
   ```
2. Drop and recreate the target database:
   ```bash
   docker compose exec db psql -U documind -d postgres -c "DROP DATABASE IF EXISTS documind_restored;"
   docker compose exec db psql -U documind -d postgres -c "CREATE DATABASE documind_restored OWNER documind;"
   ```
3. Restore schema, tables, and vector embeddings using `pg_restore`:
   ```bash
   docker compose exec -T db pg_restore \
     -U documind \
     -d documind_restored \
     --verbose \
     --clean \
     --if-exists < "${BACKUP_FILE}"
   ```
4. Verify record counts and pgvector indexing:
   ```bash
   docker compose exec db psql -U documind -d documind_restored -c "
     SELECT count(*) AS total_documents FROM documents;
     SELECT count(*) AS total_chunks FROM document_chunks;
     SELECT count(*) AS total_orders FROM orders;
   "
   ```
5. Re-point connection string to restored database and restart services:
   ```bash
   docker compose start api web
   ```

---

## 4. Retention & Storage Policy

- **Daily Backups:** Retained locally for 14 days.
- **Weekly Backups:** Replicated to encrypted offsite object storage (AWS S3 / GCS bucket with versioning and immutable object lock) for 90 days.
- **Quarterly Disaster Recovery Drill:** Execute restore procedure in staging environment every 90 days.
