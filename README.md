# DocuMind

DocuMind is an end-to-end, document-grounded question-and-answer assistant built for the VanarX Tech full-stack take-home assignment. It combines a Next.js reviewer UI, a modular FastAPI backend, PostgreSQL 16 with pgvector, an OpenAI-compatible model adapter, and controlled database tools.

> **Status — Implemented, verified, and integration-ready.** Upload validation, PDF/TXT parsing, token-aware chunking (`tiktoken`), vector persistence, hybrid retrieval (pgvector cosine + PostgreSQL FTS Reciprocal Rank Fusion), citation allowlisting, honest abstention, deterministic order routing, DB-backed order lookup, expiring ticket confirmation with idempotency, migrations, seed data, responsive UI, real SSE streaming, 24 unit/contract tests, and the 15-question gold evaluation comparison are implemented and verified.

---

## What Works

- **Document Ingestion:** PDF and TXT validation with file signature checks, SHA-256 deduplication, byte limits, and database uniqueness constraints.
- **Chunking:** `cl100k_base` tokenization with configurable chunk size and overlap (tested at 300 and 800 tokens with 50 tokens overlap).
- **Hybrid Retrieval:** pgvector cosine similarity search fused with PostgreSQL full-text search (`ts_rank_cd` and `websearch_to_tsquery`) using Reciprocal Rank Fusion (RRF).
- **Grounded Generation & Citations:** OpenAI-compatible provider with low-temperature structured output, citation allowlisting against database candidate chunk IDs, and honest abstention when evidence is absent or insufficient.
- **Controlled Agent & Database Tools:**
  - `search_docs`: Authorized document retrieval.
  - `get_order_status`: Database-backed operational lookup querying seeded order records.
  - `create_ticket`: Controlled write action protected by an expiring (10m TTL), single-use confirmation token with idempotency keys.
- **Real SSE Streaming:** Real token-by-token streaming events (`status`, `token`, `citations`, `done`, `error`) via Server-Sent Events.
- **Responsive Frontend:** Next.js 16 App Router UI with upload state, document viewer, chat streaming, citation inspection, order lookup, and evaluation dashboard.
- **Single-Domain Reverse Proxy & Hidden Backend:** All public traffic routes through `https://documind.niranjansah87.com.np`. The FastAPI backend (`127.0.0.1:8000`) is internal only, completely hidden from the browser's Network tab.

---

## Architecture

```text
Browser Client
     │ (HTTPS on documind.niranjansah87.com.np)
     ▼
Nginx Reverse Proxy
     ├── /                    ──► Next.js Frontend (127.0.0.1:3000)
     ├── /_next/static/       ──► Next.js Static Cache
     ├── /api/*               ──► FastAPI Backend (127.0.0.1:8000) [Buffering OFF for SSE]
     └── /health, /ready      ──► FastAPI Health Endpoints
                                        │
                                        ▼
                              PostgreSQL 16 + pgvector
```

### Invariants:
1. **Hidden Backend:** The browser only talks to `https://documind.niranjansah87.com.np`. In the Network tab, all calls are same-origin `/api/v1/...`. Port 8000 is internal only.
2. **SSE Streaming:** Nginx has `proxy_buffering off;` and `chunked_transfer_encoding on;` for `/api/`, preventing streaming buffering delays.
3. **Untrusted Documents:** Uploaded text is treated as untrusted data enclosed in `<untrusted_context>` tags.
4. **Verifiable Citations:** Citation IDs are validated against retrieved database records before output serialization.

---

## Repository Layout

```text
apps/
  api/
    app/
      agent/          fixed tool registry, router, search_docs tool
      api/routes/     health, ready, documents, chat, meta, tools
      core/           validated settings, error handling, logging
      db/             async SQLAlchemy models and database session
      ingestion/      validation, PDF/TXT parsing, chunking
      providers/      OpenAI-compatible client with bounded retries & streaming
      repositories/   parameterized SQL/pgvector queries
      schemas/        Pydantic v2 request/response contracts
      services/       ingestion, chat, orders, tickets use cases
    migrations/       Alembic schema migrations
    tests/            automated test suite
  web/
    app/              Next.js pages (workspace, documents, document detail, evaluation)
    components/       app shell, icons, dialogs
    lib/              typed API & SSE streaming client
data/                 sample document, orders seed, gold questions
deploy/               production Nginx configs, systemd services, build.sh, deploy.sh
docs/                 product, architecture, engineering, evaluation, and operations docs
evaluation/results/   measured raw evaluation output (latest.json)
```

---

## Running Locally Without Docker (Windows / macOS / Linux)

### 1. Prerequisites
- **Python 3.12+** and [`uv`](https://docs.astral.sh/uv/)
- **Node.js 22+** and `npm`
- **PostgreSQL 16** with the `pgvector` extension installed and running on port `5432`

### 2. Environment Configuration
Copy `.env.example` to `.env` in the repository root:

On Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

On Linux / macOS:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL=postgresql+asyncpg://documind:documind-local-only@localhost:5432/documind`
- `OPENAI_API_KEY=your_actual_openai_api_key`
- `NEXT_PUBLIC_API_BASE_URL=` (leave empty so the frontend uses internal proxy rewrites)

### 3. Start the Backend API (FastAPI)
In your first terminal:
```bash
cd apps/api

# 1. Install dependencies
uv sync --frozen

# 2. Run database migrations
uv run alembic upgrade head

# 3. Seed demo orders
uv run python -m app.seed

# 4. Start the API server
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Endpoints:
- API Liveness: <http://127.0.0.1:8000/health>
- API Readiness: <http://127.0.0.1:8000/ready>
- OpenAPI Docs: <http://127.0.0.1:8000/docs>

### 4. Start the Frontend Web App (Next.js)
In a second terminal:
```bash
cd apps/web

# 1. Install dependencies
npm ci

# 2. Start development server
npm run dev
```
Open your browser at <http://localhost:3000>. Next.js internally rewrites `/api/*` requests to `http://127.0.0.1:8000`, keeping the backend hidden in your Network tab.

---

## Running with Docker Compose

If Docker Engine and Compose are installed:

```bash
docker compose up --build
```
Compose will start PostgreSQL with pgvector, run Alembic migrations, load seed orders, and launch the API and web frontend.
- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>

Stop services with `docker compose down` (or `docker compose down -v` to delete persistent data).

---

## Production Deployment (`documind.niranjansah87.com.np`)

Production automation scripts are located in [`deploy/`](deploy/):

| File | Purpose |
| :--- | :--- |
| [`deploy/nginx/documind.conf`](deploy/nginx/documind.conf) | Production Nginx reverse proxy with SSL, security headers, static caching, and SSE streaming |
| [`deploy/nginx/documind.http.conf`](deploy/nginx/documind.http.conf) | HTTP bootstrap configuration for Let's Encrypt ACME challenge |
| [`deploy/systemd/documind-api.service`](deploy/systemd/documind-api.service) | Systemd unit running FastAPI via uvicorn daemon |
| [`deploy/systemd/documind-web.service`](deploy/systemd/documind-web.service) | Systemd unit running Next.js web application |
| [`deploy/deploy.sh`](deploy/deploy.sh) | Full initial provisioning script (Nginx, Certbot SSL, systemd, migrations, build) |
| [`deploy/build.sh`](deploy/build.sh) | Routine update and rebuild script after git pushes |
| [`deploy/README.md`](deploy/README.md) | Detailed deployment and operations manual |

### Initial Server Deployment:
```bash
cd /var/www/documind
chmod +x deploy/*.sh
sudo ./deploy/deploy.sh
```

### Ongoing Code Updates:
```bash
cd /var/www/documind
./deploy/build.sh
```

---

## Verification & Quality Commands

### Backend:
```bash
cd apps/api
uv run pytest -q -p no:cacheprovider   # 24 automated unit/contract tests
uv run ruff check . --no-cache          # Code style & linting
uv run mypy app                         # Strict static type checking (44 files)
```

### Frontend:
```bash
cd apps/web
npm run lint                            # ESLint
npm run typecheck                       # TypeScript type checking
npm run build                           # Production Next.js build
```

---

## RAG Evaluation (300 vs 800 Tokens)

The 15-question gold evaluation dataset is defined in [`docs/evaluation/GOLD_QUESTIONS.md`](docs/evaluation/GOLD_QUESTIONS.md). Real evaluation runs were executed against the provider and recorded in [`evaluation/results/latest.json`](evaluation/results/latest.json):

| Metric | 300 Tokens (Vector) | 300 Tokens (Hybrid) | 800 Tokens (Vector) | 800 Tokens (Hybrid) |
| :--- | :---: | :---: | :---: | :---: |
| **Questions Tested** | 15 | 15 | 15 | 15 |
| **Retrieval Recall@k** | 100% (15/15) | 100% (15/15) | 100% (15/15) | 100% (15/15) |
| **Context-Supported Answers** | 93.3% (14/15) | **100% (15/15)** | 60.0% (9/15) | **100% (15/15)** |
| **Citation Valid Answers** | 93.3% (14/15) | **100% (15/15)** | 60.0% (9/15) | **100% (15/15)** |
| **Mean Latency (ms)** | 1,858 ms | 1,980 ms | 1,940 ms | 2,120 ms |

**Finding:** Hybrid retrieval (PostgreSQL full-text search combined with pgvector cosine distance via Reciprocal Rank Fusion) achieved **100% answer accuracy and citation validity** across all 15 gold evaluation questions.

---

## Important Project Documentation

- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [License](LICENSE.md)
- [Production Deployment Guide](deploy/README.md) and [Operations Docs](docs/operations/DEPLOYMENT.md)
- [Product Requirements (PRD)](docs/product/PRD.md) and [System Requirements (SRS)](docs/product/SRS.md)
- [Architecture](docs/architecture/ARCHITECTURE.md), [Data Model](docs/architecture/DATA_MODEL.md), and [ADRs](docs/architecture/ADRs.md)
- [API Contract](docs/engineering/API_CONTRACT.md), [RAG Design](docs/engineering/RAG_DESIGN.md), and [Agent Tools](docs/engineering/AGENT_TOOLS.md)
- [Evaluation Plan](docs/evaluation/EVALUATION.md) and [Gold Questions](docs/evaluation/GOLD_QUESTIONS.md)
- [Agent Instructions](AGENTS.md) and [Engineering Rules](CLAUDE.md)
