# Deployment and Local Operations

## 1. Required reviewer experience

From a clean clone: 1. Copy `.env.example` to `.env`. 2. Add the
required API key and retain safe local defaults. 3. Run
`docker compose up --build`. 4. Open the frontend URL printed/documented
in README. 5. Upload the sample document and test document, order and
unknown questions.

No manual PostgreSQL installation, manual extension setup, or ad hoc
seed command should be required unless explicitly automated and
documented.

## 2. Proposed containers

-   `db`: PostgreSQL image with pgvector support; persistent named
    volume; health check.
-   `api`: FastAPI app; waits for database health; runs
    migrations/extension initialization; exposes API port.
-   `web`: Next.js app; depends on API availability as appropriate; uses
    a configurable backend base URL.

Only necessary host ports should be published. The database can remain
on the internal Compose network if local DB access is not needed.

## 3. Configuration

`.env.example` should enumerate every required and optional variable
used by code and Compose. Proposed categories: - Database:
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`. -
Provider: primary LLM API key/model, embedding API key/model if
separate, fallback model/key. - RAG: chunk sizes, overlap, top-k,
similarity threshold, retrieval strategy, reranker toggle. - Safety:
upload limit, request max length, max tool steps, tool timeout, retry
count, max output tokens/cost budget. - Runtime: API host/port, frontend
port, CORS origins, log level, environment.

Avoid defining duplicate variables unless there is a clear reason. If
one provider key serves both embeddings and generation, document it.

## 4. Database readiness and migrations

-   Use a PostgreSQL image/build that includes pgvector.
-   Run `CREATE EXTENSION IF NOT EXISTS vector` through an idempotent
    migration/init path.
-   API should retry startup connection briefly or depend on Compose
    health check.
-   Prefer migrations over ad hoc schema creation at every app startup.
-   Seed orders with a repeatable script/migration or one-time seed
    process protected against duplicate rows.

## 5. Development and verification commands

Document actual commands after scaffold, expected to include: -
`docker compose up --build` - `docker compose down` -
`docker compose logs -f api` - `docker compose exec api pytest -q` -
`docker compose exec api ...` for migrations only if needed - frontend
lint/type-check/build command.

## 6. Clean-machine verification

Before submission: - Use a fresh clone or clean directory. - Remove old
volumes if validating first-run initialization (this deletes local demo
data). - Start from `.env.example`. - Check health/readiness. - Upload
sample document via UI. - Ask a known question and verify answer +
citation. - Ask order status for a seeded order and verify tool route +
DB-backed status. - Ask an unsupported question and verify abstention. -
Trigger a tool failure in a test and verify safe output. - Check no API
key appears in logs or built frontend. - Confirm README links and
commands work.

## 7. Troubleshooting section to include in final README

-   Database unhealthy: inspect db logs and connection URL/credentials.
-   pgvector missing: verify image/extension initialization.
-   Embedding API failure: check key, quota, provider connectivity and
    logs.
-   Empty PDF extraction: scanned PDFs may need OCR; report limitation.
-   CORS error: align configured frontend origin and API CORS allowlist.
-   Port conflict: document supported port overrides.
