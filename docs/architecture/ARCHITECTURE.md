# Architecture Overview

## 1. Implemented shape: modular monolith

Use one FastAPI application organized into modules rather than multiple
network services. For this assignment, a modular monolith reduces
operational complexity while preserving clear boundaries. PostgreSQL is
the system of record. The frontend is a separate container.

## 2. Logical architecture

``` mermaid
flowchart LR
  U[Browser / Next.js] -->|REST + SSE| API[FastAPI API]
  API --> ROUTER[Intent Router]
  API --> ING[Ingestion Service]
  ING --> PARSE[PDF / TXT Parser]
  PARSE --> CHUNK[Chunker]
  CHUNK --> EMB[Embedding Provider]
  EMB --> DB[(PostgreSQL + pgvector)]
  ROUTER -->|document query| RAG[RAG Service]
  RAG --> RET[Retriever: vector / hybrid]
  RET --> DB
  RAG --> FUSE[PostgreSQL FTS + pgvector RRF]
  FUSE --> GEN[Grounded Answer Generator]
  GEN --> LLM[Primary / Fallback LLM]
  ROUTER -->|order / ticket intent| AGENT[Bounded Tool Orchestrator]
  AGENT --> TOOLS[search_docs / get_order_status / create_ticket]
  TOOLS --> DB
```

## 3. Runtime paths

### Ingestion path

1.  API validates request and content.
2.  Compute SHA-256 content hash.
3.  Check duplicate within ownership scope.
4.  Extract text, retaining page/section information where possible.
5.  Chunk using configured token target and overlap.
6.  Generate embeddings in batches with provider timeout/retry.
7.  Persist document and chunks with model/config metadata.
8.  Mark ingestion status as completed; failures should not leave a
    document falsely marked ready.

For the initial synchronous demo, ingestion can run in the upload
request with strict size limits. If time allows, model it with
`pending/processing/ready/failed` status even if execution is
synchronous. A background queue is not required unless it materially
simplifies latency/retries.

### Document question path

1.  Validate query and ownership scope.
2.  Router selects RAG for document questions.
3.  Embed query.
4.  Retrieve top-k vector candidates within scope.
5.  Combine keyword and vector candidates using reciprocal-rank fusion
    (RRF).
6.  Apply relevance/score policy.
7.  If evidence is insufficient, abstain.
8.  Generate at low temperature using only supplied excerpts.
9.  Validate returned citation IDs against retrieved candidates.
10. Return answer, citations, latency and route metadata.

### Order question path

1.  Router identifies an order lookup or asks a clarifying question if
    the identifier is missing.
2.  Validate the order ID and authorized scope.
3.  Call the database-backed `get_order_status` tool.
4.  Format only returned fields.
5.  On failure, report that the lookup could not be completed; never
    infer status.

### Ticket creation path

1.  Parse the requested action and fields.
2.  Validate required fields.
3.  Create a pending confirmation, not a ticket.
4.  Display a concise summary and ask the user to confirm.
5.  Accept confirmation only for that pending action and within its
    expiry.
6.  Create once using an idempotency key.
7.  Return ticket ID or honest failure.

## 4. Module boundaries

-   `api/routes`: HTTP request/response validation only.
-   `core`: settings, error types, logging, IDs, shared limits.
-   `db`: SQLAlchemy/driver setup and models; Alembic migrations live in
    `apps/api/migrations`.
-   `ingestion`: parsers, hashing, chunking, embedding, ingestion
    orchestration.
-   `repositories`: scoped vector query, keyword query, RRF fusion and
    persistence operations.
-   `services`: chat orchestration, citation validation, provider
    adapters.
-   `agent`: route selection, fixed tool registry and typed tool
    execution with bounded steps and no arbitrary SQL from model output.
-   `tests`: unit, integration, contract, and end-to-end tests.

## 5. Reliability patterns

-   Provider adapters isolate model SDK details.
-   Every outbound provider call has timeout and bounded retries.
-   Retry only transient failures; do not retry invalid arguments or
    most 4xx responses.
-   Use exponential backoff with jitter and an overall request deadline.
-   Add a request ID to API responses and logs.
-   Database constraints enforce deduplication and idempotency.
-   Tool writes require explicit confirmation and unique idempotency
    keys.
-   Fallback model is used only for configured retryable primary
    failures; do not silently change embeddings models for existing
    vectors.

## 6. Observability

Capture operation-level timings for parse, chunk, embed, retrieve,
retrieval, generation and total request. Logs should contain request ID,
route, status, candidate count, model identifier and durations. Avoid
logging API keys, full document contents, raw private prompts, or
personal order data.

## 7. Scalability boundaries

For the take-home, one API process and PostgreSQL are enough. Future
scaling could add background ingestion workers, object storage for
source files, Redis for cache/queue/rate limits, and separate vector
infrastructure. These are future options, not baseline requirements.
