# Software Requirements Specification (SRS)

## 1. System context

DocuMind is a containerized web application with a Next.js client,
FastAPI service, and PostgreSQL/pgvector database. External LLM and
embedding APIs are accessed by the backend only. The browser must never
receive provider API keys.

## 2. System actors

-   **Client user:** uploads documents and submits questions.
-   **Application API:** validates requests, enforces ownership scope,
    invokes ingestion/retrieval/tools, and returns responses.
-   **LLM provider:** generates embeddings and grounded language
    responses; may fail or time out.
-   **PostgreSQL:** stores documents, chunks/vectors, orders, tickets,
    and optional query/evaluation records.
-   **Reviewer/operator:** configures environment, starts containers,
    inspects logs, runs tests.

## 3. Core use cases

### UC-01 Upload a document

Preconditions: API is healthy; file is PDF or TXT; request is within
configured size limit. Main flow: validate MIME/extension and size →
read bytes safely → hash content → deduplicate in scope → parse text →
split chunks → embed → persist metadata/chunks transactionally where
feasible → return document ID/status. Alternates: unsupported type
(415), too large (413), empty/unparseable text (422), provider failure
(503/502 with safe message), duplicate (return existing document or
idempotent response). Postcondition: a document record and its chunks
are available for retrieval.

### UC-02 Ask a document question

Main flow: validate input → classify route → retrieve candidates within
allowed scope → apply retrieval threshold → rerank/merge candidates if
enabled → if insufficient evidence, abstain → generate with strict
context-only instruction → validate citations against retrieved chunk
IDs → return answer and citations. Postcondition: answer is either
grounded with citations or an explicit abstention.

### UC-03 Look up order status

Main flow: router recognizes an order lookup → validate order identifier
and user scope → call `get_order_status` → return DB-backed status or
honest not-found/tool-unavailable message. Constraint: do not use
document RAG as a substitute for order database lookup.

### UC-04 Create support ticket

Main flow: collect subject/description/order reference → validate → show
pending action and confirmation token → wait for explicit user
confirmation → create ticket once → return ticket ID. Constraint: no
write operation on implied, ambiguous, or missing confirmation.
Confirmation must be tied to the intended action and expire.

### UC-05 Unsupported question

Main flow: retrieve candidates → no candidate exceeds threshold or
answer cannot be supported → return a concise "I don't know based on the
available documents" response without fabricated facts or false
citations.

## 4. External interfaces

-   REST API under `/api/v1`.
-   Multipart upload for documents.
-   JSON for chat and tool-action requests.
-   Server-Sent Events (SSE) for streamed answer tokens/status;
    document exact event schema in API contract.
-   PostgreSQL connection via environment variable.
-   LLM/embedding provider credentials via environment variables.

## 5. Input constraints

-   Upload extensions: `.pdf`, `.txt`; server must verify content type
    rather than trust filename alone.
-   Configurable maximum upload size; implemented default: 10 MiB.
-   Query must be non-empty and bounded in length.
-   Tool arguments use Pydantic schemas and strict field validation.
-   Order identifiers use a documented format and are never interpreted
    as SQL fragments.
-   Ticket subject/description lengths are bounded and text is stored as
    data, not instructions.

## 6. Output requirements

-   Upload response contains stable document ID, filename, status, and
    duplicate indicator if applicable.
-   Chat response contains answer, route/mode, citations, and abstention
    flag/reason where appropriate.
-   Citation contains document ID/name, chunk ID/index, and optional
    page/section metadata.
-   Tool result is explicit and structured; errors do not expose stack
    traces or secrets.
-   API errors follow one consistent schema,
    e.g. `{"error":{"code":"...","message":"...","request_id":"..."}}`.

## 7. Non-functional requirements

-   API and frontend have health/readiness behavior.
-   Database initialization is repeatable and migrations/extension setup
    are automated.
-   Structured logs include request ID and operation duration but
    exclude secrets and unnecessary document content.
-   All timeouts, limits, model names, chunk settings and threshold
    values are configuration-driven.
-   Tests run without a live LLM where possible using fakes; provider
    integration tests are separately marked.
