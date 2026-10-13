# Testing Strategy

## 1. Test pyramid

### Unit tests (fast, no network)

-   Token/paragraph chunking, overlap, boundary handling and no infinite
    loops.
-   Content hashing and duplicate detection logic.
-   File validation and parser error conversion.
-   Relevance threshold/abstention policy.
-   Citation allowlist/validation.
-   Router intent decisions.
-   Pydantic tool argument validation.
-   Retry policy and max-step enforcement.
-   Ticket confirmation expiry/replay/idempotency.
-   Provider fallback decision logic.

### Integration tests

Use a disposable PostgreSQL/pgvector service or the Compose database. -
Migrations and vector extension initialization. - Insert/query
embeddings and metadata filters. - Duplicate upload race protection. -
Order tool queries seeded data. - Ticket transaction and idempotency. -
Hybrid search query/fusion behavior. - API errors and health/readiness
endpoints.

### Contract/API tests

-   Upload valid PDF/TXT.
-   Reject unsupported, empty, too-large and unparseable files.
-   Chat response shape and citation metadata.
-   Unknown question abstains.
-   User-supplied inaccessible document ID is rejected/ignored safely.
-   Order question invokes the tool path.
-   Ticket preparation does not write; confirmation does.
-   Tool failure returns honest safe output.

### End-to-end/manual tests

Follow the exact reviewer workflow on a clean Docker environment and
verify the frontend and API together.

## 2. Required assignment tests

1.  **Chunking test:** known input produces non-empty chunks, overlap
    exists, ordering is preserved, and chunks respect the target
    approximately according to the selected tokenizer.
2.  **Retrieval test:** a seeded relevant chunk is ranked for its
    question and metadata filters exclude unauthorized documents.
3.  **Tool failure test:** mock database/tool failure; ensure response
    is honest, no invented order status is returned, and the request
    does not crash.

## 3. Test doubles

-   Fake embedding provider returns deterministic vectors with expected
    dimensions.
-   Fake LLM returns structured grounded output or injected
    timeout/errors.
-   Repository dependency overrides avoid external API calls.
-   Keep provider integration tests separately marked and require
    environment credentials explicitly.

## 4. Test commands (proposed)

-   `pytest -q`
-   `pytest -q -m integration`
-   `ruff check .`
-   `mypy app` or an equivalent configured type check
-   Frontend lint/type check and production build.

The exact commands must match the actual dependency and script setup
after scaffolding.

## 5. Coverage priorities

Prioritize behavior, not a vanity coverage percentage. Required
high-risk paths: unsupported question, invalid citation, duplicate
ingestion, cross-scope retrieval, order tool failure, ticket without
confirmation, model fallback, and provider timeout.

## 6. Definition of done

-   Tests pass from a documented clean environment.
-   No test requires a real provider key unless explicitly marked
    integration.
-   Tests assert observable behavior rather than private implementation
    details.
-   Failures are deterministic and include enough context to debug
    without leaking secrets.
