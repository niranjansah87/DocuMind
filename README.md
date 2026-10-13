# DocuMind

DocuMind is a document-grounded question-and-answer assistant for the VanarX Tech full-stack take-home assignment. It combines a Next.js reviewer UI, a FastAPI modular monolith, PostgreSQL with pgvector, an OpenAI-compatible model adapter, and controlled database tools.

> **Status — implemented foundation, partially integration-tested.** Upload validation, parsing, token-aware chunking, vector persistence/retrieval, citation allowlisting, abstention, deterministic order routing, DB-backed order lookup, expiring ticket confirmation, migrations, seed data, the responsive UI, and unit tests are implemented. Docker/database/provider end-to-end execution and the 300-vs-800 evaluation are still pending because Docker and provider credentials were unavailable in the implementation environment.

## What works

- PDF and TXT validation with configurable size limits, PDF signature checks, safe parser errors, SHA-256 deduplication, and a database uniqueness constraint for concurrent duplicate uploads.
- Text extraction for UTF-8 text and text-based PDFs. Scanned-PDF OCR is intentionally not included.
- `cl100k_base` tokenization with configurable chunk size and overlap; the default runtime configuration is 800/50 tokens.
- OpenAI-compatible embeddings and grounded generation with timeouts, bounded retry for transient failures, and an optional fallback generation model.
- PostgreSQL/pgvector storage with 1,536-dimensional vectors and SQL-level demo-owner/document filters before context is returned.
- Vector retrieval, configurable similarity threshold, explicit unknown responses, and server-side citation-ID validation.
- A fixed tool registry containing `search_docs`, `get_order_status`, and `create_ticket`.
- Deterministic order-number routing to database-backed lookup; failures and not-found results are distinct and never fabricated.
- Two-step ticket preparation/confirmation with expiry, row locking, single-use enforcement, and an idempotency constraint.
- A single responsive page with upload state, document selection, SSE answer rendering, citations, explicit route labels, errors, retry, and cancellation.
- Repeatable Alembic migration and idempotent order seed loading.

## Known gaps

- The application uses one fixed demo owner. It does **not** provide authentication or production multi-tenancy.
- Hybrid keyword/vector retrieval and reranking are not implemented yet; only vector retrieval has been implemented.
- The 15 gold questions have not been executed against provider-backed 300- and 800-token datasets, so no evaluation result is claimed.
- SSE events are implemented, but the provider response is generated before the API emits token events; upstream token streaming remains future work.
- Natural-language chat routes document and order questions. Ticket preparation/confirmation currently uses the explicit API endpoints.
- Cost-budget enforcement and a model-based ambiguous-intent classifier are pending. Step, output, context, timeout, and retry limits are configured.
- PostgreSQL integration, clean Compose startup, provider calls, and the full reviewer journey were not runtime-verified on this machine because Docker was unavailable and no provider credential was supplied.

## Architecture

```text
Browser / Next.js
        │ REST + SSE
        ▼
FastAPI routes
        ├── ingestion ── parser ── chunker ── embedding adapter
        ├── chat ── deterministic router ── retrieval ── generator
        └── tools ── order service / ticket confirmation
                                      │
                                      ▼
                            PostgreSQL + pgvector
```

Routes validate HTTP input and delegate to services. Services coordinate use cases. Repositories own parameterized database access. Provider-specific HTTP calls live behind one adapter. Retrieved document text is enclosed as untrusted context; it never controls routing, authorization, or tool selection.

The application deliberately remains a modular monolith. A worker, Redis, separate vector database, and WebSockets would add clean-start and debugging cost without helping the assignment’s current scale.

## Repository layout

```text
apps/
  api/
    app/
      agent/          fixed registry, router, search_docs tool
      api/routes/     health, documents, chat, order, tickets
      core/           validated settings and safe errors
      db/             async session and SQLAlchemy models
      ingestion/      validation, PDF/TXT parsing, chunking
      providers/      OpenAI-compatible provider adapter
      repositories/   scoped database queries
      schemas/        Pydantic request/response contracts
      services/       ingestion, chat, order and ticket use cases
    migrations/       Alembic schema migration
    tests/            network-free unit/contract tests
  web/
    app/              Next.js App Router page and styles
    lib/              typed API/SSE client
data/                 uploadable sample TXT, source Markdown, order seed
docs/                 product, architecture, engineering and operations docs
evaluation/results/   reserved for measured raw evaluation output
```

## Technology

- Next.js 16, React 19, strict TypeScript
- FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic
- PostgreSQL 16 with pgvector
- `tiktoken` for chunking and `pypdf` for text-based PDF extraction
- Docker Compose with non-root API and web containers
- pytest, Ruff, mypy, ESLint, and the Next.js production build

## Quick start with Docker Compose

Prerequisites: Git, Docker Engine/Desktop with the Compose plugin, and an OpenAI-compatible API credential that supports the configured chat and embedding models.

```bash
git clone https://github.com/niranjansah87/DocuMind.git
cd DocuMind
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace `OPENAI_API_KEY=replace-me`. If the provider, model, or base URL differs, update `OPENAI_BASE_URL`, `LLM_MODEL`, `LLM_FALLBACK_MODEL`, and `EMBEDDING_MODEL`. The current migration fixes `EMBEDDING_DIMENSIONS` at `1536`; changing it requires a migration and re-embedding.

Start the stack:

```bash
docker compose up --build
```

Compose waits for PostgreSQL, runs `alembic upgrade head`, loads the fictional order seed idempotently, then starts the API and web application.

- UI: <http://localhost:3000>
- OpenAPI: <http://localhost:8000/docs>
- Liveness: <http://localhost:8000/health>
- Readiness: <http://localhost:8000/ready>

Upload [`data/sample_knowledge_document.txt`](data/sample_knowledge_document.txt), ask “How many days do I have to return an item?”, then try “Where is ORD-1002?” and an unsupported question such as “What is the capital of Japan?”.

Stop services with `docker compose down`. `docker compose down -v` also deletes the local PostgreSQL volume and all uploaded/demo data.

> Compose YAML and migration SQL were statically verified, but `docker compose up --build` was not run in the implementation environment because Docker was not installed.

## Environment configuration

All supported variables are listed in [`.env.example`](.env.example). Important groups are:

- Runtime: `APP_ENV`, `API_HOST`, `API_PORT`, `WEB_PORT`, `LOG_LEVEL`, `CORS_ORIGINS`
- Database: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`
- Provider: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LLM_MODEL`, `LLM_FALLBACK_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`
- RAG: `CHUNK_SIZE_TOKENS`, `CHUNK_OVERLAP_TOKENS`, `RETRIEVAL_TOP_K`, `RETRIEVAL_SIMILARITY_THRESHOLD`
- Safety: upload/query/output limits, tool-step limits, provider/request timeouts, retry count, and ticket confirmation TTL
- Browser-visible configuration: `NEXT_PUBLIC_API_BASE_URL` only; provider credentials never use a `NEXT_PUBLIC_` name

The default similarity threshold is a starting configuration, not a measured universal value. It must be calibrated during the pending evaluation.

## Local development

### API

Python 3.12–3.14 and [`uv`](https://docs.astral.sh/uv/) are supported.

```bash
cd apps/api
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload
```

Set `DATABASE_URL` to a reachable pgvector-enabled PostgreSQL instance first. The seed command reads the repository’s existing [`data/sample_orders.json`](data/sample_orders.json).

### Web

Node.js 22 or newer is recommended.

```bash
cd apps/web
npm ci
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` when the API is not reached through the default URL.

## API overview

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/health` | Process liveness; independent of provider/database |
| `GET` | `/ready` | Database and pgvector readiness |
| `POST` | `/api/v1/documents` | Validate, deduplicate, parse, chunk, embed, and store PDF/TXT |
| `GET` | `/api/v1/documents` | List documents in the fixed demo scope |
| `POST` | `/api/v1/chat` | SSE status/token/citations/done events for RAG or order lookup |
| `POST` | `/api/v1/tools/order-status` | Typed DB-backed order lookup |
| `POST` | `/api/v1/tickets/prepare` | Create an expiring pending action without writing a ticket |
| `POST` | `/api/v1/tickets/confirm` | Explicitly confirm and atomically create one ticket |

Errors use `{"error":{"code":"...","message":"...","request_id":"..."}}`. Provider payloads, tracebacks, document bodies, and secrets are not returned.

## Verification commands

Backend:

```bash
cd apps/api
uv run pytest -q -p no:cacheprovider
uv run ruff check . --no-cache
uv run mypy app
uv run alembic upgrade head --sql
```

Frontend:

```bash
cd apps/web
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

Observed in the implementation environment:

- pytest: **22 passed**; one upstream Starlette/AnyIO deprecation warning.
- Ruff: passed.
- mypy strict check: passed for 41 source files.
- ESLint: passed.
- TypeScript: passed.
- Next.js production build: passed; `/` and `/_not-found` were statically generated.
- Alembic offline upgrade SQL: generated successfully, including `CREATE EXTENSION IF NOT EXISTS vector` and all tables/constraints.
- Compose YAML: parsed successfully and contains `db`, `api`, and `web` services.
- `npm audit --omit=dev`: zero production vulnerabilities. The full development audit reports five high-severity `braces` findings through `eslint-config-next`; npm currently offers only a breaking downgrade path.

Database-backed integration tests, Compose startup, and provider-dependent tests were not run because the necessary runtime services/credentials were unavailable.

## RAG and evaluation

The implemented path uses one 1,536-dimensional embedding model for documents and queries, cosine distance in pgvector, a bounded top-k, a configurable threshold, low-temperature JSON generation, citation allowlisting, and exact abstention text when evidence is missing or citations are invalid.

The stable 15-question dataset is in [`docs/evaluation/GOLD_QUESTIONS.md`](docs/evaluation/GOLD_QUESTIONS.md). The required primary comparison changes only chunk size between 300 and 800 tokens while holding overlap, document, embedding model, top-k, threshold, generation model, and scoring rules constant.

| Chunk size | Correct evidence retrieved | Context-supported answers | Mean latency |
|---:|---:|---:|---:|
| 300 tokens | Pending measurement | Pending measurement | Pending measurement |
| 800 tokens | Pending measurement | Pending measurement | Pending measurement |

No winning chunk size or retrieval mode is claimed yet. Raw per-question output should be stored under `evaluation/results/` after real runs. Hybrid retrieval and reranking must be implemented before they can be compared or reported.

## Security and reliability notes

- `.env`, environments, caches, dependency trees, build output, and evaluation JSON are ignored by Git.
- Provider credentials remain server-side; the browser only receives the public API base URL.
- Original uploaded bytes are not retained; extracted chunk text and metadata are stored in PostgreSQL.
- Filename, extension, content, byte size, request shape, order format, document scope, citation IDs, and ticket fields are validated at their trust boundaries.
- The demo owner is derived server-side, not accepted from model or request input.
- Document content is treated as untrusted data and cannot select tools or issue SQL.
- Ticket writes use explicit confirmation, expiry, row locking, single-use state, and a unique idempotency key.
- External calls use bounded timeouts and retry only transient network/status failures. Ticket writes are not blindly retried.

## Troubleshooting

- **Database unhealthy:** inspect `docker compose logs db`; verify the `POSTGRES_*` values and API `DATABASE_URL` agree.
- **pgvector unavailable:** confirm the `pgvector/pgvector:pg16` image started and the Alembic migration ran.
- **Embedding or model failure:** verify the API key, base URL, quota, model names, JSON response-format support, and 1,536-dimensional embedding support.
- **Empty PDF:** scanned/image-only PDFs require OCR, which is outside the current implementation.
- **CORS error:** ensure `CORS_ORIGINS` includes the exact frontend origin.
- **Port conflict:** override `API_PORT` or `WEB_PORT` in `.env`.
- **Upload remains unavailable without a key:** health remains usable, but ingestion correctly returns a provider-unavailable error because fake embeddings are never used in production.

## Project documentation

- [PRD](docs/product/PRD.md) and [SRS](docs/product/SRS.md)
- [Architecture](docs/architecture/ARCHITECTURE.md), [data model](docs/architecture/DATA_MODEL.md), and [ADRs](docs/architecture/ADRs.md)
- [API contract](docs/engineering/API_CONTRACT.md), [RAG design](docs/engineering/RAG_DESIGN.md), and [agent/tool contracts](docs/engineering/AGENT_TOOLS.md)
- [Security](docs/engineering/SECURITY.md), [testing](docs/engineering/TESTING.md), and [frontend UX](docs/engineering/FRONTEND_UX.md)
- [Evaluation method](docs/evaluation/EVALUATION.md) and [gold questions](docs/evaluation/GOLD_QUESTIONS.md)
- [Deployment](docs/operations/DEPLOYMENT.md), [implementation plan](docs/operations/IMPLEMENTATION_PLAN.md), and [risks](docs/operations/RISKS.md)
- [Engineering instructions](CLAUDE.md) and [agent instructions](AGENTS.md)

## Next priorities

1. Run clean Compose startup with a real provider key and fix any database/provider integration findings.
2. Exercise the reviewer journey: upload, cited answer, DB-backed order lookup, unknown abstention, and ticket confirmation.
3. Add PostgreSQL integration coverage for migrations, scoped vector retrieval, duplicate races, order seed, and ticket transactions.
4. Implement hybrid retrieval and bounded reranking, then run all 15 questions at 300 and 800 tokens.
5. Save raw measurements, calibrate the threshold, choose a chunk size from evidence, and update the pending table without guessing.
