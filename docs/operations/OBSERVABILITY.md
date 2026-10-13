# Operational Observability & Monitoring Specification

## 1. Overview & Objectives

DocuMind's observability system provides actionable telemetry across the document ingestion pipeline, hybrid vector retrieval, OpenAI LLM calls, deterministic agent routing, and database transactions. It enforces strict data minimization: no raw document text, client prompts, authorization headers, or database passwords may ever be logged.

---

## 2. Structured Logging Architecture

### 2.1 Format & Environments
- **Local Development (`APP_ENV=development`):** Human-readable colored console stream with standard timestamp, log level, request ID, logger name, and message.
- **Staging & Production (`APP_ENV=production` or `LOG_FORMAT=json`):** Machine-parseable, single-line JSON records designed for log collectors (Datadog, AWS CloudWatch, Grafana Loki, Elastic).

### 2.2 Standard JSON Schema
Every JSON log event adheres to the following schema:
```json
{
  "timestamp": "2026-10-13T10:45:12.345678Z",
  "level": "INFO",
  "service": "documind-api",
  "env": "production",
  "request_id": "8f3b2e5a-7c9d-4e1a-8f2b-3c4d5e6f7a8b",
  "logger": "app.services.chat",
  "message": "HTTP POST /api/v1/chat 200 (1580.40ms)",
  "exception": null
}
```

### 2.3 Automated Credential & Token Redaction
Log records are filtered before emission by `SensitiveDataFilter`. The filter scrubs:
- OpenAI API Keys (`sk-...` -> `sk-***[REDACTED]***`)
- Bearer Tokens (`Bearer ...` -> `Bearer ***[REDACTED]***`)
- Database Connection Strings (`postgresql+asyncpg://user:pass@host:5432` -> `postgresql+asyncpg://user:***[REDACTED]***@host:5432`)
- Passwords and raw API secrets (`password=...` -> `password=***[REDACTED]***`)

---

## 3. Distributed Request Correlation

1. **Request Ingestion:** The `request_logging_middleware` extracts `X-Request-ID` from the incoming request header or mints a new UUIDv4.
2. **Context Propagation:** The identifier is stored in a Python `contextvars.ContextVar`, automatically isolating concurrent async tasks.
3. **Response Header:** Every HTTP response carries `X-Request-ID: <id>` for client-side tracing and customer support correlation.
4. **SSE Event Stream:** For streaming endpoints (`/api/v1/chat`), the request ID is included in final `done` events.

---

## 4. Application Metrics (`/metrics`)

DocuMind exposes operational metrics at `GET /metrics` in standard Prometheus text exposition format (version 0.0.4) and JSON:

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `documind_uptime_seconds` | Gauge | Application process uptime in seconds. |
| `documind_database_healthy` | Gauge | Database probe status (`1` = healthy, `0` = connection down). |
| `documind_http_requests_total` | Counter | Requests partitioned by normalized `route` and `status`. |
| `documind_http_request_duration_seconds_sum` | Counter | Cumulative latency by normalized route. |
| `documind_http_request_duration_seconds_count` | Counter | Total invocations by normalized route. |
| `documind_documents_ingested_total` | Counter | Total documents uploaded and stored in PostgreSQL. |
| `documind_document_chunks_total` | Counter | Total text chunks indexed in pgvector. |
| `documind_chat_requests_total` | Counter | Chat invocations partitioned by route (`rag` vs `order`). |
| `documind_orders_looked_up_total` | Counter | Total operational order lookups. |
| `documind_tickets_total` | Counter | Tickets partitioned by action (`prepared` vs `confirmed`). |
| `documind_rate_limit_exceeded_total` | Counter | Total requests rejected with HTTP 429. |

---

## 5. Health & Diagnostic Probes

- **Liveness (`GET /health`):** Verifies the FastAPI application event loop is executing and responsive. Returns HTTP 200 `{ "status": "ok", "service": "documind-api" }`.
- **Readiness (`GET /ready`):** Verifies PostgreSQL database connectivity and `pgvector` extension availability. Returns HTTP 200 if ready, HTTP 503 if the database or pgvector is unavailable.

---

## 6. Actionable Alerting Thresholds

| Alert Name | Severity | Condition | Actionable Runbook |
| :--- | :--- | :--- | :--- |
| **HighErrorRate5xx** | P1 (Critical) | `5xx` error rate > 2% over 5 minutes | Inspect container logs for unhandled exceptions or database pool exhaustion. |
| **DatabaseDown** | P0 (Emergency) | `documind_database_healthy == 0` for > 30s | Verify PostgreSQL container health, connection limits, and disk space. |
| **ElevatedRAGLatency** | P2 (Warning) | p95 latency on `/api/v1/chat` > 4,000ms over 10m | Check OpenAI API status, provider rate limits, and pgvector IVFFlat index health. |
| **RateLimitSpike** | P2 (Warning) | Rate limit rejections > 50 / min | Review client IPs for abusive scraping or misconfigured client retry loops. |
