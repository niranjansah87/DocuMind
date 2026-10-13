# Implementation Plan and Definition of Done

## 1. Execution Strategy

DocuMind implements the modular application, RAG pipeline, bounded tools, frontend routes, automated tests, and benchmark evaluation. The assignment-required clean-machine Compose workflow is not complete because the current Compose file does not provision PostgreSQL.

---

## 2. Completed Phase Matrix

### Phase 0 - Documentation and Decisions
- [x] Capture VanarX Tech assignment requirements.
- [x] Define PRD, SRS, architecture, data model, ADRs, API contract, RAG design, agent tools, security, testing, and evaluation docs.
- [x] Confirm provider/model names (`text-embedding-3-small`, `gpt-4.1-mini`), token counting method (`tiktoken`), and environment configuration.

### Phase 1 - Scaffold and Infrastructure
- [x] Monorepo structure: `apps/api` (FastAPI), `apps/web` (Next.js 16), `data/`, `evaluation/`.
- [x] PostgreSQL with pgvector supported through Alembic migrations.
- [ ] Docker Compose starts database, API, and web from a clean clone. Current Compose starts API and web only and requires an external database.
- [x] `.env.example` template with clear placeholders.
- [x] Structured request IDs, standardized error envelope, and `/health`, `/ready` endpoints.

### Phase 2 - Database and Seed Data
- [x] Relational schema: `documents`, `document_chunks`, `orders`, `support_tickets`, `pending_actions`.
- [x] Exact pgvector cosine search on `document_chunks.embedding` (1536 dims). No IVFFlat/HNSW index is created for the small assignment dataset.
- [x] Seed data: repeatable order dataset (`ORD-1001`, `ORD-1002`, `ORD-1003`) and sample customer policy.
- [x] Database constraints and foreign key cascading.

### Phase 3 - Ingestion Pipeline
- [x] Accept PDF and TXT with server-side size and MIME validation (`MAX_UPLOAD_BYTES`).
- [x] SHA-256 byte-hash deduplication within owner scope.
- [x] Page-aware text extraction (`pypdf`) preserving `page_start`, `page_end`, and `section_title`.
- [x] Token-aware chunker (`tiktoken`) with configurable chunk size (300 and 800 tokens) and overlap (50 tokens).
- [x] Batched OpenAI embedding generation with retry/backoff.
- [x] Safe persistence into PostgreSQL and pgvector.

### Phase 4 - RAG and Grounded Generation
- [x] Cosine distance vector search in pgvector with scope filtering.
- [x] Hybrid retrieval combining vector similarity with PostgreSQL full-text search using Reciprocal Rank Fusion (RRF).
- [x] Calibrated similarity threshold (`0.35`) favoring explicit abstention over hallucination.
- [x] Grounded generation prompt restricting answers strictly to retrieved context.
- [x] Server-side citation validation: citation chunk IDs must strictly belong to retrieved candidates; citation metadata resolved from DB.
- [x] Explicit abstention on unsupported/unknown questions (`"I don't know based on the available documents."`).
- [x] Real-time Server-Sent Events (SSE) streaming (`status`, `token`, `citations`, `done`, `error`).

### Phase 5 - Router and Controlled Agent Tools
- [x] Deterministic intent routing (order regex patterns routed to DB tool; general questions routed to RAG).
- [x] `search_docs` tool: authorized document search.
- [x] `get_order_status` tool: PostgreSQL database lookup with ownership authorization; returns `{found: false}` on missing orders without fabrication.
- [x] `create_ticket` tool: Two-stage confirmation guardrail (`POST /api/v1/tickets/prepare` creates pending action; `POST /api/v1/tickets/confirm` executes write).
- [x] Single-use token and 600s TTL expiry with replay prevention (`409 CONFIRMATION_ALREADY_USED`).
- [x] Bounded steps, timeouts, and fallback model configuration.

### Phase 6 - Frontend Design Realization
- [x] Four responsive frontend workflows based on the reference designs in `design/`:
  - `Documind_workspace.png` → `/` (Workspace, Chat, Inline Citations, Right Sources Inspector, Ticket Modal).
  - `documind_documents_page.png` → `/documents` (Banner, Filter Pills, Documents Table, Slide-out Drawer).
  - `documind_documents_details_page.png` → `/documents/[id]` (Thumbnails Rail, Canvas with highlighted excerpts, Chunk Inspector).
  - `documind_evaluation_page.png` → `/evaluation` (Comparison Cards, SVG Charts, 15 Gold Questions Table, Insights Sidebar).
- [x] Custom SVG iconography (no generic emojis).
- [x] Brand identity assets copied to `apps/web/public/` (`logo.png`, `logo_mark.png`, `favicon.ico`).
- [x] Zero TypeScript errors (`tsc --noEmit`), zero ESLint warnings, Next.js production build passing.

### Phase 7 - Evaluation, Testing, and Verification
- [x] Complete 15-question gold benchmark executed comparing 300 vs 800 token chunks across Vector and Hybrid retrieval.
- [x] 800 tokens with Hybrid retrieval established as optimal (100% recall, 100% supported, 1591ms mean latency).
- [x] Full backend test suite passing (`pytest` 50/50 passed at the latest recorded verification).
- [x] Strict linting and type checking passing (`ruff check`, strict `mypy` across 63 source files at the latest recorded verification).
- [x] A 13-step live E2E run is documented in `docs/engineering/TESTING.md`; it was not repeated during the documentation audit.

---

## 3. Definition of Done Checklist

| Criterion | Target | Actual State | Verified |
| :--- | :--- | :--- | :---: |
| Document Ingestion | PDF & TXT, hash dedup, page/section metadata | Fully implemented and tested | Yes |
| Vector Storage | pgvector in PostgreSQL, 1536 dims | Fully implemented and tested | Yes |
| Grounded Answers | Answer strictly from retrieved context | Fully implemented and tested | Yes |
| Citation Integrity | Server-validated chunk IDs, DB-resolved metadata | Fully implemented and tested | Yes |
| Honest Abstention | Explicit unknown response on missing facts | Fully implemented and tested | Yes |
| Database Tool | `get_order_status` queries PostgreSQL | Fully implemented and tested | Yes |
| Ticket Guardrail | Two-stage confirm, single-use, replay protection | Fully implemented and tested | Yes |
| Frontend Design | Responsive workspace, documents, details and evaluation workflows | Implemented from the reference designs | Yes |
| Automated Tests | Unit and integration coverage | 50 pytest tests at latest verification | Yes |
| Static Analysis | Python (ruff, strict mypy), Web (tsc, eslint) | 0 errors across all checks | Yes |
| Clean Compose startup | Database, API and web from one command | Database service missing from current Compose file | **No** |
| Documentation | API contract, RAG, UX, evaluation, README | Audited against current repository state | Yes |
