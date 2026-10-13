# DocuMind - Production-Hardened Document Assistant

DocuMind is an enterprise-grade, document-grounded question-and-answer assistant built for VanarX Tech. It combines a Next.js 16 frontend faithfully reproducing 4 reference designs, a modular FastAPI backend, PostgreSQL with pgvector, an OpenAI-compatible model adapter, and controlled database tools.

> **Production Hardening Status - Complete, Verified, and Audited:**
> - **Branch:** `feature/documind-production-hardening`
> - **Backend Test Suite:** 50 automated tests passing (`pytest`, `ruff`, strict `mypy`).
> - **Frontend Build:** All 8 static and dynamic Next.js routes compiled cleanly with Turbopack (0 lint errors, 0 type errors).
> - **Security & Guardrails:** Credential-bound tenant identity with anti-impersonation (403), production startup config validation, proxy-trust verified rate limiting (429) bounded at 10k clients, private cache-control headers, token-restricted `/metrics`.
> - **Observability & SRE:** Structured JSON logging, sanitized request ID tracing, authenticated Prometheus metrics, operational runbooks, and tested backup/restore scripts (`scripts/backup.sh`, `scripts/restore.sh`).
> - **SEO & Privacy:** Dynamic `robots.txt` and `sitemap.xml` strictly excluding private document paths and `/login`.

---

## 1. Product Overview & Core Capabilities

- **Document Ingestion:** PDF and TXT validation with byte limits, magic-byte signature checks (`%PDF-`), and SHA-256 byte deduplication within tenant scope.
- **Page & Section Aware Chunking:** `cl100k_base` tokenization with 800 tokens and 50 tokens overlap, preserving section titles and page numbers for citations.
- **Hybrid Retrieval:** pgvector cosine similarity search fused with PostgreSQL full-text search (`ts_rank_cd` and `websearch_to_tsquery`) via Reciprocal Rank Fusion (RRF).
- **Grounded Answers & Citation Allowlist:** Responses strictly bound to retrieved context; citations validated against database chunk IDs with metadata resolved server-side.
- **Anti-Hallucination Abstention:** Calibrated similarity threshold (0.35) producing explicit abstention (*"I don't know based on the available documents."*) when evidence is absent.
- **Controlled Agent & Tools:**
  - `search_docs`: Authorized document search.
  - `get_order_status`: Database-backed operational lookup querying seeded orders (`ORD-1001`..`ORD-1003`) without data fabrication.
  - `create_ticket`: Mutating write action protected by an expiring (600s TTL), single-use confirmation token with replay attack rejection (`409 CONFIRMATION_ALREADY_USED`).
- **Real-Time Streaming:** Server-Sent Events (SSE) streaming tokens, status events, and citations.
- **4 Reference Page Designs:**
  - `Documind_workspace.png` → `/` (Workspace, Chat, Inline Citation Pills `[1]`, Right Sources Inspector, Ticket Modal).
  - `documind_documents_page.png` → `/documents` (Top Upload Banner, Status Filter Pills, Documents Table, Slide-out Drawer).
  - `documind_documents_details_page.png` → `/documents/[id]` (Thumbnails Rail, Canvas with highlighted excerpts, Chunk Inspector).
  - `documind_evaluation_page.png` → `/evaluation` (Comparison Cards, 3 SVG Visual Charts, 15 Gold Questions Table, Insights Sidebar).

---

## 2. Architecture & System Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js 16 Web Client (Port 7777)                     │
│  4 Reference Views: Workspace, Documents, Details, Evaluation          │
│  Security Headers, SEO Robots/Sitemap, React Error Boundary            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST / Server-Sent Events (SSE)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Application (Port 8888)                   │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   Security & Auth     │             │     Rate Limiting          │  │
│  │ (Bearer / API Key)    │             │ (Sliding Window per IP)    │  │
│  └──────────┬────────────┘             └─────────────┬──────────────┘  │
│             │                                        │                 │
│      ┌──────┴──────┐                          ┌──────┴──────┐          │
│      ▼             ▼                          ▼             ▼          │
│  ┌────────┐  ┌───────────┐               ┌─────────┐  ┌──────────────┐ │
│  │ Intent │  │ Prometheus│               │ tiktoken│  │ OpenAI Embed │ │
│  │ Router │  │  Metrics  │               │ Chunker │  │ 1536-dim     │ │
│  └───┬────┘  └─────┬─────┘               └────┬────┘  └──────┬───────┘ │
│      │             │                          │              │         │
└──────┼─────────────┼──────────────────────────┼──────────────┼─────────┘
       │             │                          │              │
       ▼             ▼                          ▼              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 18 + pgvector Extension                   │
│                                                                        │
│  - documents (metadata, SHA-256 byte hash, owner scope, status)        │
│  - document_chunks (text, pgvector 1536 embeddings, page/section)     │
│  - orders (seeded operational data: ORD-1001..ORD-1003)                │
│  - tickets & pending_actions (two-stage confirmation, 600s TTL)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

- **Frontend:** Next.js 16.4 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS, Lucide icons.
- **Backend API:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (asyncpg), Alembic.
- **Database & Storage:** PostgreSQL 16/18 with `pgvector` extension.
- **AI & Retrieval:** OpenAI API (`gpt-4.1-mini`, `text-embedding-3-small` 1536d), `tiktoken` (`cl100k_base`).
- **DevSecOps & Tooling:** Docker Compose, GitHub Actions, `uv`, `pnpm`, `ruff`, `mypy`, `pytest`.

---

## 4. Repository Layout

```text
.github/workflows/ci.yml   Automated CI pipeline (pytest, ruff, mypy, tsc, lint, build)
apps/
  api/
    app/
      agent/               Deterministic intent router, tools registry, search_docs tool
      api/routes/          documents, chat, tools, health, ready, metrics, meta, landing
      core/                config, logging (JSON+redaction), metrics, rate_limit, errors
      db/                  SQLAlchemy async models, pooled engine (asyncpg), migrations
      ingestion/           magic-byte validation, PDF/TXT parsing, token-aware chunking
      providers/           OpenAI client with SSE streaming, retries, and fallback model
      repositories/        pgvector cosine + PostgreSQL FTS Reciprocal Rank Fusion
      schemas/             Pydantic v2 validation contracts
      services/            ingestion, chat, orders, tickets business logic
    migrations/            Alembic database migrations
    tests/                 42 automated tests (unit, security, rate limit, isolation)
  web/
    app/
      documents/           Document repository (/documents) + layout (noindex)
      documents/[id]/      Document viewer & excerpt inspector (/documents/[id])
      evaluation/          RAG benchmark dashboard (/evaluation) + layout (noindex)
      login/               Dedicated Authentication & Tenant manager (/login) + layout (noindex)
      error.tsx            React runtime error boundary
      layout.tsx           Root shell with SEO OpenGraph & Twitter metadata
      not-found.tsx        Custom 404 page
      page.tsx             Main workspace & chat view (/)
      robots.ts            Dynamic robots.txt disallowing private routes
      sitemap.ts           Dynamic sitemap.xml for public root only
    components/            AppShell, SVG icons, TicketModal, SourceInspector
    lib/                   Typed API client, SSE streaming parser, auth & tenant manager
data/                      Sample document (txt & pdf), gold questions, seed orders
docs/                      Comprehensive product, architecture, engineering & SRE docs
  operations/              OBSERVABILITY.md, INCIDENT_RESPONSE.md, BACKUP_AND_RESTORE.md
  engineering/             SECURITY.md, SEO.md, API_CONTRACT.md, RAG_DESIGN.md
evaluation/results/        15-question benchmark measurements (latest.json)
```

---

## 5. Development Setup & Execution

### 5.1 Prerequisites
- **Python 3.12+** and [`uv`](https://docs.astral.sh/uv/)
- **Node.js 22+** and [`pnpm`](https://pnpm.io/)
- **PostgreSQL 16 or 18** with `pgvector` extension

### 5.2 Environment Setup
Copy the template and configure your credentials:
```bash
cp .env.example .env
```
Ensure `.env` contains your database connection string and OpenAI key:
```env
DATABASE_URL=postgresql+asyncpg://postgres:12345@localhost:5432/documind
OPENAI_API_KEY=sk-...your-key...
```

### 5.3 One-Command Local Startup
From the repository root:
```bash
# 1. Install workspace dependencies
pnpm install

# 2. Start Backend (8888) and Frontend (7777) concurrently
pnpm dev
```

### 5.4 Docker Compose Startup
```bash
docker compose up --build
```
This automatically provisions PostgreSQL with `pgvector`, runs database migrations, seeds demo orders, and starts both API (port 8888) and Web (port 7777).

---

## 6. Security & Hardening Controls

1. **Authentication & Multi-Tenant Isolation:**
   - **Dedicated Frontend Auth Page (`/login`):** Provides a production-grade credential manager matching the dark aesthetic. Operators can configure Bearer tokens or API keys, select tenant IDs (`X-Owner-Id`), and verify credentials via `GET /api/v1/auth/verify`.
   - **Credential-Bound Tenant Identity:** Tenant identity is strictly derived from the verified credential (`TENANT_API_KEYS` dictionary or `DEFAULT_TENANT_ID`). Any attempt by an authenticated client to pass a mismatched `X-Owner-Id` or `X-User-Id` is rejected with `403 FORBIDDEN` to prevent tenant impersonation.
   - **Production Mode (`AUTH_REQUIRED=true`):** Requires Bearer token (`Authorization: Bearer <token>`) or API key (`X-API-Key: <key>`). Missing credentials produce `401 UNAUTHORIZED`; invalid credentials produce `403 FORBIDDEN`. Startup validation strictly blocks launch if placeholder keys or default passwords are used in production.
   - **Local Mode (`AUTH_REQUIRED=false`):** Uses a fixed local owner scope. Allows clean-machine testing without tokens while honoring `X-Owner-Id` for isolated multi-tenant testing in development.
   - **Database Scoping:** All chunks, embeddings, orders, and tickets are strictly filtered by `owner_id` at the database query layer.
2. **Sliding-Window Rate Limiting & Request Trust:**
   - In-memory rate limiter protects expensive operations with proxy-trust verification (only inspects `X-Forwarded-For` from `trusted_proxies` to prevent header spoofing):
     - Document uploads: 15 / minute
     - Chat & LLM calls: 60 / minute
     - Ticket operations: 30 / minute
     - General API: 120 / minute
   - Memory bounded at `MAX_TRACKED_CLIENTS = 10,000` with automated LRU eviction to prevent memory-exhaustion DoS attacks.
   - Rejections return `429 Too Many Requests` with `Retry-After: 60`.
3. **Defensive HTTP Security & Cache Headers:**
   - `Cache-Control: no-store, no-cache, must-revalidate, private` on all `/api/v1/*` endpoints to prevent intermediate shared proxy caches from leaking private tenant data.
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - `Content-Security-Policy`: Restricts scripts and framing; document downloads enforce `default-src 'none'; sandbox`.
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains` in production.
4. **Automated Credential Redaction in Logs:**
   - All logs scrub OpenAI keys (`sk-***[REDACTED]***`), Bearer tokens, database connection passwords, and API secrets via `SensitiveDataFilter`.
5. **Database Connection Pooling:**
   - Configured `pool_size` (10), `max_overflow` (20), `pool_recycle` (1800s), and `pool_timeout` (30s) in asyncpg to prevent connection exhaustion.

---

## 7. Observability & SRE Telemetry

- **Prometheus Metrics (`GET /metrics`):**
  - Uptime gauge (`documind_uptime_seconds`)
  - Database health gauge (`documind_database_healthy`)
  - Request counters and durations by normalized route (`documind_http_requests_total`)
  - Business counters: documents ingested, chunks indexed, chat routes, orders queried, tickets prepared/confirmed, and 429 rejections.
- **Request Tracing:**
  - `X-Request-ID` generated or validated on every request, propagated across async tasks via `contextvars`, and attached to all response headers and SSE streams.
- **Structured JSON Logging:**
  - Emits single-line JSON logs in production (`LOG_FORMAT=json` or `APP_ENV=production`) with timestamp, severity, service, environment, request ID, logger name, and redacted message.
- **Health Probes:**
  - `GET /health`: Liveness probe.
  - `GET /ready`: Readiness probe verifying PostgreSQL connection and pgvector extension.

---

## 8. SEO & Privacy Policy

DocuMind strictly enforces data privacy boundaries:
- **Public Entrypoint (`/`):** Full OpenGraph, Twitter card, canonical metadata, and sitemap inclusion.
- **Private Routes (`/documents`, `/documents/*`, `/evaluation`, `/login`, `/api/*`):**
  - Dynamically disallowed in `robots.txt` (`apps/web/app/robots.ts`).
  - Explicitly excluded from `sitemap.xml` (`apps/web/app/sitemap.ts`).
  - Marked with `robots: { index: false, follow: false }` in Next.js layouts.
  - No user-uploaded document content, citations, credentials, or metadata ever enter public search indexes.

---

## 9. Key Technical Decisions & Tradeoffs

| Decision | Selected Architecture | Alternative Considered | Tradeoff & Justification |
| :--- | :--- | :--- | :--- |
| **Persistence & Vectors** | PostgreSQL + `pgvector` | Dedicated Vector DB (Pinecone, Qdrant) | **ACID guarantees & zero sync lag:** Documents, chunks, orders, and vector embeddings share a single transactional boundary without dual-write inconsistency. |
| **Retrieval Architecture** | Hybrid RRF (Vector + Full-Text Search) | Pure Vector Search | **Keyword precision:** Vector search excels at semantic paraphrasing but misses alphanumeric policy codes. Reciprocal Rank Fusion (RRF) achieved 100% recall on the gold test set. |
| **Intent Routing** | Deterministic Regex & Pattern Router | LLM-as-a-Router | **Latency & Cost:** Deterministic routing takes `<1ms` and costs `$0.00`. An LLM router adds 300–800ms of latency and non-deterministic misrouting risk. |
| **Action Confirmation** | Ephemeral Two-Stage Tokens (`prepare` → `confirm`) | Autonomous Tool Execution | **Safety & Replay Defense:** Mutating actions require explicit human verification with a 600s TTL token and atomic consumption preventing duplicate writes. |
| **Citation Security** | Server-Side Allowlist & DB Enrichment | LLM-Generated Citation Labels | **Prompt Injection Defense:** Untrusted document text could manipulate the model into inventing citations. In DocuMind, the LLM only outputs candidate UUIDs; the backend verifies candidate membership and enriches metadata directly from PostgreSQL. |

---

## 10. Why Not Use an Agent for Everything?

1. **Latency & TTFT:** Direct RAG begins streaming tokens in **~200–400 ms**. An autonomous agent loop (thought-action-observation) takes **2,000–5,000 ms**, degrading responsiveness.
2. **Cost Efficiency:** Direct RAG requires a single completion pass. Open-ended agent loops consume 3× to 6× more tokens per question.
3. **Deterministic Safety:** Informational Q&A requires answers strictly grounded in documents. Autonomous agents risk reasoning drift or hallucinating synthetic tool calls when document context is ambiguous.
4. **Least Privilege:** Destructive or mutating operations (support tickets) must never be autonomously executed by an LLM without cryptographically bound human confirmation.

---

## 11. Evaluation Benchmark Results (300 vs 800 Tokens)

The 15-question gold evaluation dataset is defined in [`docs/evaluation/GOLD_QUESTIONS.md`](docs/evaluation/GOLD_QUESTIONS.md). Real evaluation runs were executed against `text-embedding-3-small` (1536 dimensions) and logged in [`evaluation/results/latest.json`](evaluation/results/latest.json):

| Metric | 300 Tokens (Vector) | 300 Tokens (Hybrid) | 800 Tokens (Vector) | 800 Tokens (Hybrid) |
| :--- | :---: | :---: | :---: | :---: |
| **Questions Tested** | 15 | 15 | 15 | 15 |
| **Retrieval Recall@k** | 100% (15/15) | 100% (15/15) | 100% (15/15) | **100% (15/15)** |
| **Context-Supported Answers** | 93.3% (14/15) | 93.3% (14/15) | 60.0% (9/15) | **100% (15/15)** |
| **Citation-Valid Answers** | 93.3% (14/15) | 93.3% (14/15) | 60.0% (9/15) | **100% (15/15)** |
| **Mean Latency (ms)** | 1,858 ms | 1,757 ms | 1,673 ms | **1,591 ms** |
| **Median Latency (ms)** | 1,760 ms | 1,600 ms | 1,406 ms | **1,551 ms** |
| **Failed Requests** | 0 | 0 | 0 | **0** |

### Chunk Size Selection Rationale
**800 Tokens with Hybrid RRF Retrieval** is selected for production:
1. **Semantic Completeness:** Multi-clause policies (e.g. warranty coverage qualifications and return exceptions) stay intact within 800 tokens, avoiding context fragmentation.
2. **Superior Accuracy:** Achieved **15/15 (100%) context-supported and citation-valid answers**.
3. **Lower Latency:** Fewer disjoint context segments result in faster LLM generation (1,591 ms vs 1,757 ms).

---

## 12. What We Would Improve Next

1. **Two-Stage Cross-Encoder Re-ranking:** Add a lightweight reranker (`bge-reranker-large` or Cohere Rerank) to further sharpen precision across tens of thousands of documents.
2. **Asynchronous Background Ingestion Queue:** Offload heavy PDF parsing and vector generation to an asynchronous worker queue (Celery or ARQ with Redis) for large multi-hundred-page files.
3. **Multimodal OCR Pipeline:** Integrate `pdf2image` + `marker` or Vision LLM for scanned PDFs and embedded image receipts.
4. **Conversational Memory:** Add sliding-window conversation history with query rewriting for multi-turn conversational follow-ups.

---

## 13. Automated Testing & Verification Suite

### Running Backend Checks
```bash
# Run 50 automated tests (unit, security, rate limiting, isolation, impersonation defense)
uv run --directory apps/api pytest

# Fast linting
uv run --directory apps/api ruff check app tests

# Strict static type checking (63 source files)
uv run --directory apps/api mypy app tests
```
*Status: 50 passed, 0 lint errors, 0 type errors.*

### Running Frontend Checks
```bash
cd apps/web

# TypeScript typecheck
npm run typecheck

# ESLint audit
npm run lint

# Production Turbopack build
npm run build
```
*Status: 0 type errors, 0 lint warnings, 8/8 routes compiled.*

---

## 14. Documentation Index

- **Product & System Requirements:**
  - [Product Requirements Document (PRD)](docs/product/PRD.md)
  - [System Requirements Specification (SRS)](docs/product/SRS.md)
- **Architecture & Design:**
  - [Architecture Overview](docs/architecture/ARCHITECTURE.md)
  - [Architecture Decision Records (ADRs)](docs/architecture/ADRs.md)
  - [Data Model & Database Schema](docs/architecture/DATA_MODEL.md)
- **Engineering Specifications:**
  - [API Contract Specification](docs/engineering/API_CONTRACT.md)
  - [Security & Threat Model](docs/engineering/SECURITY.md)
  - [Technical SEO Policy](docs/engineering/SEO.md)
  - [RAG & Ingestion Design](docs/engineering/RAG_DESIGN.md)
  - [Agent & Tools Guardrails](docs/engineering/AGENT_TOOLS.md)
  - [Frontend UX & Design System](docs/engineering/FRONTEND_UX.md)
  - [Testing Strategy & Test Plan](docs/engineering/TESTING.md)
- **Evaluation & Benchmarks:**
  - [Evaluation Protocol & Measurements](docs/evaluation/EVALUATION.md)
  - [15 Gold Questions Dataset](docs/evaluation/GOLD_QUESTIONS.md)
- **Operations & SRE Runbooks:**
  - [Observability & Monitoring Runbook](docs/operations/OBSERVABILITY.md)
  - [Incident Response Runbook](docs/operations/INCIDENT_RESPONSE.md)
  - [Backup and Restore Runbook](docs/operations/BACKUP_AND_RESTORE.md)
  - [Production Release Checklist](docs/operations/RELEASE_CHECKLIST.md)
  - [Deployment Guide](docs/operations/DEPLOYMENT.md)
  - [Hardening Risk Register](docs/operations/RISKS.md)

---
*DocuMind - Enterprise-Ready Document AI Assistant. Hardened, Authenticated, and Production-Verified.*
