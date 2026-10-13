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

## 6. Authentication and demo limitations

The assignment does not explicitly require login. A single-user demo may
use a fixed demo scope, but must not claim full multi-tenant
authorization. The data model and repository interfaces should make
ownership explicit so authentication can be added without rewriting
retrieval. If real multi-user auth is implemented, scope must come from
a verified session/token, not client-supplied `owner_id`.

## 7. Privacy and retention

-   Document whether original uploads are stored or only extracted
    text/chunks are retained.
-   Avoid sending more context to the LLM than required.
-   Do not include real personal, customer or order data in fixtures.
-   Define cleanup behavior for failed ingestion and optional document
    deletion.
-   Evaluation logs should store IDs, scores and timing by default;
    store text only when necessary for debugging.
