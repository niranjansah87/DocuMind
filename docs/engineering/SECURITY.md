# Security, Privacy and Threat Model

## 1. Scope

This is a take-home demo, not a certified production system. The
implementation should still demonstrate sensible security boundaries and
clearly state any demo-only shortcuts.

## 2. Assets

-   Uploaded document contents and extracted text.
-   Embeddings and metadata.
-   Order/customer-like data in seeded records.
-   Support ticket contents.
-   LLM and embedding provider API keys.
-   Database credentials.
-   Pending confirmation actions.
-   Logs and evaluation traces.

## 3. Threats and mitigations

  -----------------------------------------------------------------------
  Threat                              Mitigation
  ----------------------------------- -----------------------------------
  Oversized or malformed upload       Byte-size limit, type/signature
                                      validation, parse exception
                                      handling, no stack trace to client

  Duplicate ingestion race            Scoped SHA-256 uniqueness
                                      constraint and idempotent
                                      transaction

  Prompt injection in documents       Treat retrieved text as untrusted;
                                      tool policy enforced in application
                                      code

  Cross-document/user leakage         Authorization filters applied in
                                      SQL before text reaches LLM

  SQL injection                       Parameterized ORM/queries; no
                                      model-generated SQL

  Unauthorized order lookup           Validate identity/ownership in
                                      server-side tool; demo limitations
                                      documented

  Unconfirmed ticket write            Two-step pending action and
                                      explicit, expiring confirmation

  Replay/double ticket                Idempotency key and atomic
                                      confirmation consumption

  Provider key leakage                Server-only env variables; never
                                      expose to frontend or logs

  Denial of service/cost abuse        Upload/query limits, bounded
                                      top-k/context/tokens/steps,
                                      timeouts and rate limits where
                                      feasible

  Citation spoofing                   Resolve citation metadata from DB;
                                      accept only retrieved chunk IDs

  Dependency compromise               Pin dependencies, review lockfile,
                                      update known vulnerabilities before
                                      submission

  Sensitive logs                      Structured metadata, redact tokens
                                      and avoid full content logging

  Container exposure                  Expose only needed ports; DB need
                                      not be publicly exposed outside
                                      Compose network
  -----------------------------------------------------------------------

## 4. Secret management

-   `.env` must be gitignored.
-   `.env.example` contains names and safe placeholder values only.
-   Do not put actual API keys in README, tests, screenshots, sample
    data, or source.
-   Frontend must call backend; provider credentials remain in backend.
-   Rotate any secret accidentally committed.

## 5. Input and output controls

-   Validate all request bodies with Pydantic.
-   Limit message length, document size, context size, retrieved chunk
    count, generation tokens and tool steps.
-   Escape rendered document text in the UI; do not render arbitrary
    HTML from source documents.
-   Return stable error codes and request IDs, not tracebacks.
-   Treat LLM-generated tool arguments and citations as untrusted until
    validated.

## 6. Authentication and Multi-Tenant Isolation (Implemented & Hardened)

DocuMind supports dual-mode operation for local evaluation and production deployment:
- **Dedicated Frontend Auth Page (`/login`):** An intuitive credentials manager allowing operators and reviewers to input an API Key / Bearer token, switch tenant scopes (`X-Owner-Id`), verify credentials via `GET /api/v1/auth/verify`, and seamlessly switch back to Reviewer Demo Mode with a single click. The client automatically attaches `Authorization: Bearer <token>` and `X-Owner-Id: <tenant>` across all fetch and SSE requests via `apps/web/lib/auth.ts`.
- **Credential-Bound Tenant Identity:** Tenant identity is strictly derived from the verified credential (`TENANT_API_KEYS` dictionary or `DEFAULT_TENANT_ID`). Any attempt by an authenticated client to pass a mismatched `X-Owner-Id` or `X-User-Id` is rejected with `403 FORBIDDEN` to prevent tenant impersonation.
- **Production Startup Validation:** When `APP_ENV=production`, `AUTH_REQUIRED` is forced to `true`, and startup aborts immediately if credentials or database passwords use insecure default placeholders.
- **Local / Reviewer Mode (`AUTH_REQUIRED=false`):** Defaults to `DEMO_OWNER_ID` (`00000000-0000-0000-0000-000000000001`), allowing clean-machine testing without pre-configured tokens. Honors `X-Owner-Id` or `X-User-Id` request headers for isolated multi-tenant testing in development.
- **Database & Vector Isolation:** All document chunks, embeddings, order records, and tickets are strictly filtered by `owner_id` at the SQL query layer before context reaches the LLM.

## 7. Rate Limiting & Request Trust (Implemented & Hardened)

- **Sliding-Window Rate Limiter:** An in-memory sliding window limiter (`SlidingWindowRateLimiter`) throttles requests per client IP or authenticated token.
- **Proxy Trust Verification:** Guards against `X-Forwarded-For` header spoofing by only inspecting forward headers when the immediate socket peer is an explicitly configured trusted proxy (`trusted_proxies` setting).
- **Memory Bounds & DoS Defense:** Capped at `MAX_TRACKED_CLIENTS = 10,000` with automated sliding-window pruning and LRU eviction under high-cardinality spoofing attempts.
- **Per-Route Quotas:**
  - Document Uploads: 15 / minute
  - Chat & LLM Queries: 60 / minute
  - Ticket Operations: 30 / minute
  - General API: 120 / minute
- **Response Headers:** `429 Too Many Requests` returns `Retry-After: 60`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining`.

## 8. HTTP Defensive Security & Cache Headers (Implemented)

FastAPI and Next.js enforce standard browser defenses:
- `Cache-Control: no-store, no-cache, must-revalidate, private` on all `/api/v1/*` routes to prevent shared intermediate caches from storing private tenant documents, citations, or answers.
- `X-Content-Type-Options: nosniff` (prevents MIME confusion attacks)
- `X-Frame-Options: DENY` (clickjacking protection)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy`: Restricts script and object execution; document downloads enforce `default-src 'none'; sandbox`.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced when `APP_ENV=production`).

## 9. Privacy and retention

-   Original uploads are processed in memory; extracted text and chunks are retained in PostgreSQL.
-   Avoid sending more context to the LLM than required.
-   Do not include real personal, customer or order data in fixtures.
-   Automated log scrubbing via `SensitiveDataFilter` masks OpenAI keys, Bearer tokens, and database passwords.
-   Evaluation logs store IDs, scores, and timing; text is stored only in sanitized benchmark artifacts.
