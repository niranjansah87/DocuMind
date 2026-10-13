# Testing and Verification Strategy

## 1. Test Pyramid & Execution

DocuMind enforces automated coverage across unit, integration, contract, and live end-to-end verification levels.
All test suites run deterministically without requiring external network dependencies (mocks are utilized for isolated tests; live integration tests run against PostgreSQL with pgvector).

---

## 2. Test Execution Commands & Verification Results

### 2.1 Backend Test Suite (Python / FastAPI)
- **Unit and Integration Tests (`pytest`):**
  ```bash
  uv run --directory apps/api pytest
  ```
  **Latest recorded result:** 50 passed. Coverage includes chunk boundary calculation, overlap monotonicity, PDF/TXT parsing, citation validation, order tool lookup, ticket confirmation lifecycle, replay protection, authentication isolation, rate limiting, and error envelopes.

- **Fast Code Quality & Linting (`ruff`):**
  ```bash
  uv run --directory apps/api ruff check app tests
  ```
  **Result:** All checks passed with 0 issues.

- **Strict Static Type Checking (`mypy`):**
  ```bash
  uv run --directory apps/api mypy app tests
  ```
  **Latest recorded result:** Success: no issues found across 63 source files.

### 2.2 Frontend Verification (Next.js 16 / TypeScript / ESLint)
- **TypeScript Type Verification:**
  ```bash
  cd apps/web && npm run typecheck
  ```
  **Result:** `tsc --noEmit` exited with code 0. Zero TypeScript errors.

- **ESLint Code Quality Check:**
  ```bash
  cd apps/web && npm run lint
  ```
  **Result:** `eslint .` exited with code 0. Zero errors, zero warnings.

- **Production Bundle Build:**
  ```bash
  cd apps/web && npm run build
  ```
  **Latest recorded result:** Turbopack production compilation succeeded with 8 static/dynamic routes, including `/`, `/documents`, `/documents/[id]`, `/evaluation`, `/login`, `/robots.txt`, and `/sitemap.xml`.

### 2.3 Live End-to-End User Journey Verification
The following journey was recorded against PostgreSQL with pgvector. It is historical verification and was not rerun during the latest documentation audit:
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

## 3. Coverage Priorities & Safety Invariants

- **Zero Fabricated Tool Data:** Order lookups never return synthetic answers if not found in database.
- **Citation Allowlist:** Citations are rejected unless their chunk ID belongs to the server-retrieved set for that turn.
- **Single-Use Confirmation:** Tickets cannot be created without user approval; confirmation tokens expire after 600s and reject replay attempts.
- **Content-Byte Deduplication:** Hash checks prevent duplicate chunking within tenant scope.
