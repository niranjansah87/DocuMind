# PostgreSQL & pgvector Backup and Restore Runbook

## 1. Overview & Objectives

DocuMind stores both relational data (documents, chunks, orders, tickets) and high-dimensional vector embeddings (`vector(1536)`) within PostgreSQL. This runbook establishes automated backup procedures, point-in-time recovery workflows, and disaster recovery recovery targets.

- **Recovery Point Objective (RPO):** < 1 hour (daily full snapshots + WAL archiving).
- **Recovery Time Objective (RTO):** < 30 minutes.

---

## 2. Backup Procedures

### 2.1 Automated Full Logical Dump (`scripts/backup.sh`)
DocuMind provides an executable backup tool in `scripts/backup.sh` that generates PostgreSQL's custom archive format (`-Fc`) including schema definitions, table data, and pgvector embeddings in a compressed archive with SHA-256 verification and automatic 14-day retention pruning:

```bash
# Run standalone backup script
./scripts/backup.sh
```

The script performs:
1. Container liveness verification.
2. `pg_dump` execution with `--blobs -Fc` format preserving vector tables.
3. Integrity validation using `pg_restore --list`.
4. SHA-256 checksum generation (`.sha256`).
5. Pruning of dumps older than 14 days.

> [!NOTE]
> Operational boundary: While `scripts/backup.sh` is fully executable and verified, production automated cron execution or offsite S3 object-lock replication is an infrastructure-layer orchestration task requiring host-level crontab or cloud scheduler configuration.

---

## 3. Database Restore Procedures

> [!CAUTION]
> Never restore directly into a live production database while traffic is active. Always restore into an isolated staging database or temporary container first to verify data integrity.

### 3.1 Restoring via Script (`scripts/restore.sh`)
Execute the restore script against a designated backup file and target database:
```bash
./scripts/restore.sh ./backups/documind_backup_YYYYMMDD_HHMMSS.dump documind_restored
```

### 3.2 Manual Recovery Procedure
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

