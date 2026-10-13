# Incident Response & Disaster Recovery Runbook

## 1. Severity Levels & Escalation Matrix

| Severity | Definition | Response Target | Initial Actions |
| :--- | :--- | :--- | :--- |
| **P0 - Emergency** | Complete service outage, data corruption, database downtime, credential leak. | < 15 minutes | Page on-call engineer, check container status, initiate rollback or read-only failover. |
| **P1 - Critical** | Ingestion pipeline broken, chat failure rate > 5%, OpenAI provider quota exhausted. | < 1 hour | Switch to fallback LLM model, check provider credits, inspect rate-limiting metrics. |
| **P2 - Major** | Elevated latency (>4s p95), non-critical tool failure, localized UI glitch. | < 4 hours | Inspect slow query logs, review active database connections, analyze error boundaries. |
| **P3 - Minor** | Cosmetic defect, minor documentation typo, routine performance optimization. | Next business day | File tracking issue, schedule in sprint. |

---

## 2. Common Incident Triage Procedures

### Scenario A: PostgreSQL Database Connection Failure
**Symptoms:** Readiness probe returns HTTP 503 (`DATABASE_UNAVAILABLE`), `documind_database_healthy == 0`.

**Triage Steps:**
PostgreSQL is deployed externally in production; the Compose database service is only a commented reference. Use the database platform's native tooling or set `DB_CONTAINER` when PostgreSQL runs in a separate container.

1. Check the configured database container:
   ```bash
   export DB_CONTAINER=<postgres-container-name>
   docker ps --filter "name=$DB_CONTAINER"
   docker logs "$DB_CONTAINER" --tail 100
   ```
2. Verify PostgreSQL is listening and port 5432 is open:
   ```bash
   docker exec "$DB_CONTAINER" pg_isready -U documind -d documind
   ```
3. Check disk space on database volume:
   ```bash
   docker exec "$DB_CONTAINER" df -h /var/lib/postgresql/data
   ```
4. Restart database container if hung:
   ```bash
   docker restart "$DB_CONTAINER"
   ```

### Scenario B: OpenAI API Outage or Quota Depletion
**Symptoms:** Chat requests fail with HTTP 503 (`PROVIDER_UNAVAILABLE`), logs report HTTP 429 from OpenAI.

**Triage Steps:**
1. Inspect provider error logs:
   ```bash
   docker compose logs api | grep -i "provider"
   ```
2. Check OpenAI account usage and status at <https://status.openai.com>.
3. If primary model (`gpt-4.1-mini`) is impaired, configure fallback model in `.env`:
   ```env
   LLM_FALLBACK_MODEL=gpt-4o-mini
   ```
4. Reload API service:
   ```bash
   docker compose restart api
   ```

### Scenario C: Rate Limit Rejections / DDoS Attack
**Symptoms:** Legitimate users report HTTP 429 (`RATE_LIMIT_EXCEEDED`).

**Triage Steps:**
1. Check metrics for rate limit rejections:
   ```bash
   curl -s http://localhost:8888/metrics | grep rate_limit
   ```
2. Identify abusive IP addresses from reverse proxy / API access logs:
   ```bash
   docker compose logs api | grep "HTTP 429"
   ```
3. Temporarily adjust rate limits in `.env` if legitimate burst traffic:
   ```env
   RATE_LIMIT_CHAT_PER_MINUTE=120
   ```

---

## 3. Post-Incident Review Protocol

Within 24 hours of resolving any P0 or P1 incident:
1. Document the incident timeline (Detection -> Triage -> Mitigation -> Resolution).
2. Identify root cause using the *5 Whys* methodology.
3. Commit action items to prevent recurrence (e.g. adding automated alerts, tuning pool sizes, adding retry logic).

