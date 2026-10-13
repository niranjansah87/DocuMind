# Implementation Plan and Definition of Done

## 1. Execution strategy

Build vertical slices. Every phase should leave the repository runnable
and tested. Avoid starting optional infrastructure before the
reviewer-critical path works.

## 2. Phases

### Phase 0 --- Documentation and decisions

-   [x] Capture assignment requirements.
-   [x] Define PRD, SRS, architecture,
    API/data/RAG/tool/security/test/evaluation docs.
-   [ ] Confirm provider/model names, token counting method and exact
    environment variable names before coding.

**Exit:** documentation baseline is coherent; open decisions are
visible.

### Phase 1 --- Scaffold and infrastructure

-   Create monorepo folders, FastAPI and Next.js apps.
-   Add PostgreSQL/pgvector Compose service, health checks, Dockerfiles
    and `.env.example`.
-   Add migrations, request IDs, consistent errors and health endpoints.
-   Add CI-friendly lint/test commands.

**Exit:** `docker compose up --build` starts all three services on a
clean machine.

### Phase 2 --- Database and sample data

-   Add documents/chunks/orders/tickets/pending-action schema.
-   Add sample document and deterministic order seed.
-   Verify DB constraints and repeatable seed behavior.

**Exit:** DB is ready and seed records can be queried.

### Phase 3 --- Ingestion

-   Implement file validation, PDF/TXT parsing, hashing, chunking,
    embeddings and persistence.
-   Add duplicate upload behavior and status/error responses.
-   Add unit/integration tests.

**Exit:** sample upload creates searchable chunks and re-upload does not
duplicate them.

### Phase 4 --- RAG and citations

-   Implement vector search, filters, threshold, grounded prompt,
    citation validation and abstention.
-   Add streaming response contract and frontend integration.
-   Implement vector baseline before hybrid enhancements.

**Exit:** known answer has valid citations; unknown question abstains;
citations cannot be spoofed.

### Phase 5 --- Router and tools

-   Implement route selection and `search_docs`, `get_order_status`,
    `create_ticket`.
-   Add typed validation, timeout/retry, bounded steps, model fallback
    and honest failures.
-   Implement pending confirmation/idempotent ticket write.

**Exit:** order question calls DB tool; ticket is not written before
confirmation; tool failure never invents status.

### Phase 6 --- Frontend

-   Upload area, document list, chat stream, citation list,
    loading/error/retry.
-   Display route/tool information for reviewer verification.
-   Check responsive and keyboard interactions.

**Exit:** end-to-end reviewer journey works from UI.

### Phase 7 --- Evaluation and hardening

-   Run 15 questions at 300 and 800 tokens.
-   Compare vector-only and hybrid if implemented.
-   Save raw results and update README with measured metrics.
-   Run test suite, lint/type checks, clean-machine test.
-   Review `.env.example`, `.gitignore`, license/README and repository
    cleanliness.

**Exit:** all P0 acceptance criteria pass and all unimplemented P1s are
disclosed honestly.

## 3. Suggested time budget (relative, adapt to actual deadline)

-   15%: scaffold/Compose/database
-   20%: ingestion/chunking/embedding
-   20%: retrieval/grounded answer/citations
-   15%: router/tools/guardrails
-   10%: frontend
-   10%: evaluation
-   10%: tests, README, clean-machine verification

Do not spend most of the time polishing UI before the
upload→retrieval→cited-answer path works.

## 4. Definition of done

-   All P0 requirements in PRD have test evidence.
-   Reviewer walkthrough passes with only documented `.env`
    configuration.
-   Three required automated test categories pass.
-   Gold evaluation includes actual results, not placeholder claims.
-   README explains architecture, run commands, tradeoffs and next
    improvements.
-   No committed secrets or real personal data.
-   Git status is clean except intended deliverables; repository is
    pushed/shared or ZIP is ready.
