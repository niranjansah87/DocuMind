# DocuMind

DocuMind is an end-to-end, document-grounded question-and-answer assistant built for the VanarX Tech full-stack take-home assignment. It combines a Next.js 16 reviewer UI reproducing 4 reference designs, a modular FastAPI backend, PostgreSQL 18 with pgvector, an OpenAI-compatible model adapter, and controlled database tools.

> **Status — Fully Implemented, Verified Live, and Benchmarked.** Upload validation, PDF/TXT parsing with page/section retention, token-aware chunking (`tiktoken`), vector persistence, hybrid retrieval (pgvector cosine + PostgreSQL FTS Reciprocal Rank Fusion), citation allowlisting, honest abstention, deterministic order routing, DB-backed order lookup, expiring ticket confirmation with idempotency and replay protection, database migrations, seed data, 4 reference-accurate UI screens matching `design/`, real SSE streaming, 25 unit/integration tests, and the 15-question gold evaluation comparison across 4 configurations are implemented and verified.

---

## 1. What Works & Core Capabilities

- **Document Ingestion:** PDF and TXT validation with byte limits, SHA-256 deduplication within owner scope, and database uniqueness constraints.
- **Page & Section Aware Chunking:** `cl100k_base` tokenization with configurable chunk size (300 and 800 tokens) and overlap (50 tokens), mapping character offsets to `page_start`, `page_end`, and `section_title`.
- **Hybrid Retrieval:** pgvector cosine similarity search fused with PostgreSQL full-text search (`ts_rank_cd` and `websearch_to_tsquery`) using Reciprocal Rank Fusion (RRF).
- **Grounded Generation & Citations:** Structured generation strictly bound to retrieved context, citation allowlisting against database candidate chunk IDs, and honest abstention when evidence is absent or insufficient (`"I don't know based on the available documents."`).
- **Controlled Agent & Database Tools:**
  - `search_docs`: Authorized document retrieval.
  - `get_order_status`: Database-backed operational lookup querying seeded order records (`ORD-1001`, `ORD-1002`, `ORD-1003`). Differentiates not-found from service failures without data fabrication.
  - `create_ticket`: Controlled write action protected by an expiring (10m TTL), single-use confirmation token with idempotency and replay attack rejection (`409 CONFIRMATION_ALREADY_USED`).
- **Real SSE Streaming:** Real token-by-token streaming events (`status`, `token`, `citations`, `done`, `error`) via Server-Sent Events.
- **Reference-Accurate Frontend:** Next.js 16 App Router UI reproducing 100% of the 4 visual designs in `design/`:
  - `Documind_workspace.png` → `/` (Workspace, Chat, Inline Citation Pills `[1]`, Right Sources Inspector, Ticket Modal).
  - `documind_documents_page.png` → `/documents` (Top Upload Banner, Status Filter Pills, Documents Table, Slide-out Drawer).
  - `documind_documents_details_page.png` → `/documents/[id]` (Thumbnails Rail, Canvas with highlighted excerpts, Chunk Inspector).
  - `documind_evaluation_page.png` → `/evaluation` (Comparison Cards, 3 SVG Visual Charts, 15 Gold Questions Table, Insights Sidebar).

---

## 2. Architecture Overview

```text
Browser Client (Next.js 16 App Router)
     │ (REST + Server-Sent Events)
     ▼
FastAPI Application (Modular Monolith)
     ├── /health, /ready      ──► Liveness & Extension Probes
     ├── /api/v1/documents    ──► Ingestion (PDF/TXT Parser + tiktoken Chunker)
     ├── /api/v1/chat         ──► Intent Router (Direct RAG vs Controlled Agent Tools)
     ├── /api/v1/tools        ──► Parameterized PostgreSQL Order Lookup
     ├── /api/v1/tickets      ──► Two-Stage Confirmation Guardrail (Prepare -> Confirm)
     └── /api/v1/evaluation   ──► Benchmark Runner & 15 Gold Questions
                                        │
                                        ▼
                         PostgreSQL 18 + pgvector Extension
                         (Relational Tables + 1536-dim Vector Embeddings)
```

### Critical Invariants:
1. **Grounded Output Only:** The model answers strictly using retrieved excerpts.
2. **Citation Allowlist:** Citations are rejected unless their chunk ID belongs to the server-retrieved candidate set for that turn. Citation metadata (page, section, title) is resolved from database records, not model generation.
3. **No Fabricated Tool Data:** Order lookups never return synthetic answers if not found in the database.
4. **Single-Use Confirmation:** Support tickets cannot be written without explicit user confirmation. Tokens expire in 600s and prevent replay attacks.
5. **Byte-Hash Deduplication:** Duplicate document uploads within owner scope are detected via SHA-256 byte hashes and reuse existing indexed chunks.

---

## 3. Repository Layout

```text
apps/
  api/
    app/
      agent/          fixed tool registry, router, search_docs tool
      api/routes/     health, ready, documents, chat, meta, tools
      core/           validated settings, error handling, logging
      db/             async SQLAlchemy models and database session
      ingestion/      validation, PDF/TXT parsing, chunking with page/section mapping
      providers/      OpenAI-compatible client with bounded retries & streaming
      repositories/   parameterized SQL/pgvector queries with RRF fusion
      schemas/        Pydantic v2 request/response contracts
      services/       ingestion, chat, orders, tickets use cases
    migrations/       Alembic schema migrations
    tests/            automated test suite (25 tests passing)
  web/
    app/              Next.js 16 pages matching all 4 design/ mockups
      page.tsx        Workspace & Chat (Documind_workspace.png)
      documents/      Documents repository & drawer (documind_documents_page.png)
      documents/[id]/ Deep document viewer & excerpt highlights (documind_documents_details_page.png)
      evaluation/     RAG benchmark suite & gold questions (documind_evaluation_page.png)
    components/       app shell, SVG icons, ticket modal
    lib/              typed API & SSE streaming client
    public/           brand assets (logo.png, logo_mark.png, favicon.ico)
data/                 sample knowledge document, orders seed, gold questions
deploy/               production Nginx configs, systemd services, deploy scripts
docs/                 product, architecture, engineering, evaluation, and operations docs
evaluation/results/   measured raw evaluation output (latest.json)
```

---

## 4. Running Locally

### 4.1 Prerequisites
- **Python 3.12+** and [`uv`](https://docs.astral.sh/uv/)
- **Node.js 20+** and `npm`
- **PostgreSQL 16 or 18** with `pgvector` extension enabled on port `5432`

### 4.2 Environment Setup
Copy `.env.example` to `.env` in the repository root:

On Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```
On Linux / macOS:
```bash
cp .env.example .env
```

Ensure `.env` contains your PostgreSQL database URL and OpenAI API key:
```env
DATABASE_URL=postgresql+asyncpg://postgres:12345@localhost:5432/documind
OPENAI_API_KEY=your_actual_openai_api_key
```

### 4.3 Start the Backend API (FastAPI)
```bash
cd apps/api

# 1. Install dependencies
uv sync --frozen

# 2. Run database migrations
uv run alembic upgrade head

# 3. Seed demo orders (ORD-1001, ORD-1002, ORD-1003)
uv run python -m app.seed

# 4. Start the API server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Endpoints:
- API Liveness: <http://localhost:8000/health>
- API Readiness: <http://localhost:8000/ready>
- OpenAPI Docs: <http://localhost:8000/docs>

### 4.4 Start the Frontend Web App (Next.js)
```bash
cd apps/web

# 1. Install dependencies
npm ci

# 2. Start development server
npm run dev
```
Open <http://localhost:3000> in your browser.

---

## 5. Running with Docker Compose

If Docker Engine and Docker Compose are installed:

```bash
docker compose up --build
```
Compose will start PostgreSQL with pgvector, run Alembic migrations, load seed orders, and launch the API and web frontend.
- Frontend: <http://localhost:3000> (or configured `WEB_PORT`)
- Backend: <http://localhost:8000> (or configured `API_PORT`)

To stop services:
```bash
docker compose down
```

---

## 6. Automated Testing & Verification

### 6.1 Backend Test Suite (FastAPI / Python)
```bash
# Run 25 automated unit and integration tests
uv run --directory apps/api pytest

# Fast code style & linting
uv run --directory apps/api ruff check app tests

# Strict static type checking (55 source files)
uv run --directory apps/api mypy app tests
```
**Outcome:** 25 passed in 1.83s. Ruff and strict Mypy passed with 0 issues.

### 6.2 Frontend Quality Checks (Next.js / TypeScript / ESLint)
```bash
cd apps/web

# TypeScript strict type checking
npm run typecheck

# ESLint code quality
npm run lint

# Production Next.js build
npm run build
```
**Outcome:** Zero TypeScript errors, zero ESLint warnings, Next.js Turbopack production compilation succeeded for all 4 routes.

### 6.3 Live E2E User Journey Verification
Tested against running PostgreSQL with pgvector:
1. `GET /health` & `GET /ready` → 200 OK.
2. `GET /api/v1/meta` → 200 OK.
3. `POST /api/v1/documents` → 201 Created (PDF & TXT parsed, chunked, embedded with pgvector).
4. Duplicate upload detection → 200 OK with `duplicate: true`.
5. `GET /api/v1/documents/{id}` & `GET /download` → 200 OK.
6. Order lookup `ORD-1001` → 200 OK (status: processing).
7. Missing order `ORD-9999` → 200 OK with `found: false` (no fabrication).
8. Ticket prepare → 201 Created (pending action generated).
9. Ticket confirm → 201 Created (ticket `TKT-D47003EF` created).
10. Ticket replay attack → 409 Conflict (`CONFIRMATION_ALREADY_USED`).
11. RAG streaming chat → 200 OK (grounded answer with verified inline citations).
12. Unknown question chat → 200 OK (explicit abstention `"I don't know based on the available documents."`).
13. Order intent routing → 200 OK (routed to database tool).

---

## 7. RAG Benchmark Evaluation (300 vs 800 Tokens)

The 15-question gold evaluation dataset is defined in [`docs/evaluation/GOLD_QUESTIONS.md`](docs/evaluation/GOLD_QUESTIONS.md). Real evaluation runs were executed against `text-embedding-3-small` (1536 dimensions) and recorded in [`evaluation/results/latest.json`](evaluation/results/latest.json):

| Metric | 300 Tokens (Vector) | 300 Tokens (Hybrid) | 800 Tokens (Vector) | 800 Tokens (Hybrid) |
| :--- | :---: | :---: | :---: | :---: |
| **Questions Tested** | 15 | 15 | 15 | 15 |
| **Retrieval Recall@k** | 100% (15/15) | 100% (15/15) | 100% (15/15) | 100% (15/15) |
| **Context-Supported Answers** | 93.3% (14/15) | **100% (15/15)** | 60.0% (9/15) | **100% (15/15)** |
| **Citation-Valid Answers** | 93.3% (14/15) | **100% (15/15)** | 60.0% (9/15) | **100% (15/15)** |
| **Mean Latency (ms)** | 1,858 ms | 1,794 ms | 913 ms | 1,591 ms |
| **Median Latency (ms)** | 1,760 ms | 1,600 ms | 1,406 ms | 1,551 ms |
| **Failed Requests** | 0 | 0 | 0 | 0 |

### Evaluation Findings & Decision:
1. **Hybrid Retrieval Superiority:** Combining vector search with PostgreSQL full-text search using Reciprocal Rank Fusion (RRF) achieved **100% answer accuracy and citation validity** across both chunk sizes.
2. **Chunk Size Recommendation:** **800 tokens with Hybrid retrieval** is recommended for production. It delivers 100% recall, 100% supported answers, captures multi-sentence policies without boundary splits, and achieves a faster mean response time (1,591 ms vs 1,794 ms for 300 tokens).

---

## 8. Documentation Index

- [Product Requirements (PRD)](docs/product/PRD.md)
- [System Requirements (SRS)](docs/product/SRS.md)
- [Architecture Overview](docs/architecture/ARCHITECTURE.md)
- [Architecture Decision Records (ADRs)](docs/architecture/ADRs.md)
- [Data Model & Schema](docs/architecture/DATA_MODEL.md)
- [API Contract (Implemented)](docs/engineering/API_CONTRACT.md)
- [Frontend UX & Design System](docs/engineering/FRONTEND_UX.md)
- [Ingestion & RAG Design](docs/engineering/RAG_DESIGN.md)
- [Router & Agent Tools](docs/engineering/AGENT_TOOLS.md)
- [Security & Threat Model](docs/engineering/SECURITY.md)
- [Testing Strategy & Results](docs/engineering/TESTING.md)
- [Evaluation Protocol & Measurements](docs/evaluation/EVALUATION.md)
- [Gold Questions Dataset](docs/evaluation/GOLD_QUESTIONS.md)
- [Operations & Deployment](docs/operations/DEPLOYMENT.md)
- [Implementation Plan & Definition of Done](docs/operations/IMPLEMENTATION_PLAN.md)
- [Risk Register](docs/operations/RISKS.md)

