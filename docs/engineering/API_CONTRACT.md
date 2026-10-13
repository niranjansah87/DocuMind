# API Contract (Implemented and Verified)

Base path: `/api/v1` (with top-level `/health` and `/ready` probes).
All endpoints adhere to typed Pydantic schemas, strict authorization scoping, and structured error responses.

---

## 1. System Health & Probes

### `GET /health`
Returns process liveness.

```json
{
  "status": "ok"
}
```

### `GET /ready`
Checks PostgreSQL connectivity and `vector` extension readiness.

```json
{
  "status": "ready",
  "dependencies": {
    "database": "ok"
  }
}
```
*Returns `503 Service Unavailable` if database connection or vector extension is unavailable.*

### `GET /metrics`
Exposes operational metrics in Prometheus text exposition format (default) or JSON when `Accept: application/json` is supplied.
- **Cache-Control:** `no-store, no-cache, must-revalidate`
- **Output:** Prometheus gauges/counters for uptime, database health, HTTP requests by route and status, request latencies, ingestion totals, chat routes, order queries, ticket actions, and rate limit rejections.

### Standard Security & Operational Headers
Every API response includes:
- `X-Request-ID`: Trace identifier (UUIDv4) for request correlation.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-RateLimit-Limit`: Maximum requests permitted per window.
- `X-RateLimit-Remaining`: Remaining requests in current window.
- When `429 Too Many Requests`: Includes `Retry-After: 60`.

### Authentication Headers
- `Authorization: Bearer <token>` or `X-API-Key: <key>`: Required when `AUTH_REQUIRED=true`.
- `X-Owner-Id: <uuid>`: Optional tenant identifier header for multi-tenant isolation testing.

---

## 2. Documents API

### `POST /api/v1/documents`
Uploads and indexes a document.
- **Content type:** `multipart/form-data`, field `file`.
- **Accepted formats:** PDF (`application/pdf`) and TXT (`text/plain`).
- **Maximum size:** Configurable via `MAX_UPLOAD_BYTES` (default 10 MB).
- **Deduplication:** Computes SHA-256 byte hash. Identical uploads in scope reuse existing records.

**Success (Fresh Ingestion - 201 Created):**
```json
{
  "document_id": "8b2be449-2a62-45e3-8f37-fa286333dbde",
  "filename": "Customer Support Policy.pdf",
  "status": "ready",
  "duplicate": false,
  "chunk_count": 24
}
```

**Success (Duplicate Detected - 200 OK):**
```json
{
  "document_id": "8b2be449-2a62-45e3-8f37-fa286333dbde",
  "filename": "Customer Support Policy.pdf",
  "status": "ready",
  "duplicate": true,
  "chunk_count": 24
}
```

**Errors:**
- `413 Payload Too Large`: File exceeds `MAX_UPLOAD_BYTES`.
- `415 Unsupported Media Type`: File format not `.pdf` or `.txt`.
- `422 Unprocessable Content`: Empty file or no parseable text extracted.
- `503 Service Unavailable`: Embedding provider down or timeout.

### `GET /api/v1/documents`
Lists all documents within the caller's permitted owner scope.

**Response (200 OK):**
```json
[
  {
    "document_id": "8b2be449-2a62-45e3-8f37-fa286333dbde",
    "filename": "Customer Support Policy.pdf",
    "status": "ready",
    "created_at": "2026-10-13T04:41:07Z",
    "byte_size": 2516582,
    "mime_type": "application/pdf",
    "page_count": 12
  }
]
```

### `GET /api/v1/documents/{document_id}`
Retrieves full document detail including its indexed chunks and token metrics.

**Response (200 OK):**
```json
{
  "document_id": "8b2be449-2a62-45e3-8f37-fa286333dbde",
  "filename": "Customer Support Policy.pdf",
  "status": "ready",
  "created_at": "2026-10-13T04:41:07Z",
  "byte_size": 2516582,
  "mime_type": "application/pdf",
  "page_count": 12,
  "chunk_count": 24,
  "chunk_size_tokens": 800,
  "overlap_tokens": 50,
  "chunks": [
    {
      "chunk_id": "c-1",
      "chunk_index": 0,
      "text": "This Customer Support Policy explains how we handle customer requests...",
      "token_count": 28,
      "section": "1. Introduction",
      "page_start": 1,
      "page_end": 1
    }
  ]
}
```

### `GET /api/v1/documents/{document_id}/download`
Downloads the original document bytes with appropriate `Content-Disposition` and `Content-Type` headers.
- **Response:** Raw binary or text stream (`200 OK`).

### `DELETE /api/v1/documents/{document_id}`
Deletes a document and cascades deletion to all associated chunks in pgvector.
- **Response:** `204 No Content`.

---

## 3. Streaming Chat API

### `POST /api/v1/chat`
Streams real-time answers, routing status, and citations via Server-Sent Events (SSE).

**Request:**
```json
{
  "message": "How many days do customers have to return items?",
  "document_ids": ["8b2be449-2a62-45e3-8f37-fa286333dbde"]
}
```

**SSE Event Flow:**
1. `event: status` — Route classification and processing stage (`retrieving` or `answering`).
   ```text
   data: {"route": "rag", "stage": "retrieving"}
   ```
2. `event: token` — Incremental answer text tokens.
   ```text
   data: {"text": "Customers have 30 days"}
   ```
3. `event: citations` — Verified citation candidates grounded in retrieved chunks.
   ```text
   data: [{"document_id": "8b2be449-2a62-45e3-8f37-fa286333dbde", "document_name": "Customer Support Policy.pdf", "chunk_id": "c-1", "chunk_index": 0, "section": "Returns", "page_start": 1, "page_end": 1, "quote": "Customers may return items within 30 calendar days of delivery."}]
   ```
4. `event: done` — Final completion payload with metadata.
   ```text
   data: {"route": "rag", "abstained": false, "latency_ms": 1420, "answer": "Customers have 30 days to return eligible items."}
   ```

**Abstention Behavior:**
When retrieved evidence is below the similarity threshold or does not contain required facts, the system explicitly abstains:
```text
event: token
data: {"text": "I don't know based on the available documents."}
event: done
data: {"route": "rag", "abstained": true, "latency_ms": 15, "answer": "I don't know based on the available documents."}
```

---

## 4. Controlled Agent Tools

### `POST /api/v1/tools/order-status`
Database-backed order lookup tool. Parameterized and scoped to user ownership.

**Request:**
```json
{
  "order_number": "ORD-1001"
}
```

**Found Response (200 OK):**
```json
{
  "found": true,
  "order_number": "ORD-1001",
  "status": "processing",
  "items": ["USB-C hub"],
  "updated_at": "2026-10-02T11:00:00Z"
}
```

**Not Found Response (200 OK):**
```json
{
  "found": false,
  "order_number": "ORD-9999",
  "status": null,
  "items": [],
  "updated_at": null
}
```

---

## 5. Support Ticket Confirmation Lifecycle

### `POST /api/v1/tickets/prepare`
Stage 1: Prepares a pending support ticket action. Does **not** write to the ticket database.

**Request:**
```json
{
  "subject": "Exchange damaged item",
  "description": "Item was damaged during shipping. Requesting replacement.",
  "order_number": "ORD-1001"
}
```

**Response (201 Created):**
```json
{
  "confirmation_required": true,
  "pending_action_id": "2375fbd2-cc66-409d-96f2-580c0520aeef",
  "summary": "Create a ticket titled 'Exchange damaged item' for ORD-1001.",
  "expires_at": "2026-10-13T05:10:59Z"
}
```

### `POST /api/v1/tickets/confirm`
Stage 2: Consumes the pending action token and executes the ticket write. Single-use and replay protected.

**Request:**
```json
{
  "pending_action_id": "2375fbd2-cc66-409d-96f2-580c0520aeef",
  "confirmed": true
}
```

**Success (201 Created):**
```json
{
  "created": true,
  "ticket_id": "d47003ef-7fa4-4097-9578-26f7b7e7938c",
  "ticket_number": "TKT-D47003EF",
  "status": "open"
}
```

**Replay or Expired Attempt (409 Conflict):**
```json
{
  "error": {
    "code": "CONFIRMATION_ALREADY_USED",
    "message": "The ticket confirmation was already used.",
    "request_id": "f9564dd5-b413-4660-bd5b-70d83284cdcd"
  }
}
```

---

## 6. Metadata & Evaluation APIs

### `GET /api/v1/meta`
Returns runtime workspace settings and model configuration.

**Response (200 OK):**
```json
{
  "application_name": "DocuMind",
  "workspace_name": "Customer Support Workspace",
  "scope_label": "Standard Support Scope",
  "accepted_extensions": [".pdf", ".txt"],
  "max_upload_bytes": 10485760,
  "max_query_chars": 4000,
  "suggested_questions": [
    "What items are not eligible for refund?",
    "How long does a refund take?",
    "What is the return process?"
  ],
  "order_example": "ORD-1001",
  "order_number_pattern": "^ORD-[0-9]{4,}$",
  "embedding_model": "text-embedding-3-small",
  "embedding_dimensions": 1536,
  "retrieval_strategy": "hybrid",
  "retrieval_top_k": 5,
  "chunk_size_tokens": 800,
  "chunk_overlap_tokens": 50
}
```

### `GET /api/v1/auth/verify`
Validates authentication credentials and returns current tenant scope and auth requirement mode.

**Response (200 OK):**
```json
{
  "authenticated": true,
  "owner_id": "00000000-0000-0000-0000-000000000001",
  "auth_required": false
}
```

### `GET /api/v1/evaluation`
Retrieves benchmark evaluation specifications and 15 gold evaluation questions.

**Response (200 OK):**
```json
{
  "dataset": "sample_knowledge_document.txt",
  "questions": [
    {
      "id": "Q01",
      "question": "How many days after delivery can a customer return an eligible item?",
      "expected_answer": "Within 30 days of delivery.",
      "gold_section": "Returns and Refunds"
    }
  ],
  "embedding_model": "text-embedding-3-small",
  "embedding_dimensions": 1536,
  "retrieval_strategy": "hybrid",
  "chunk_sizes": [300, 800],
  "status": "ready",
  "runs": [],
  "command": "python -m app.evaluation.runner"
}
```

---

## 7. Error Format Standard

All error responses strictly follow the standardized envelope:
```json
{
  "error": {
    "code": "DOCUMENT_TOO_LARGE",
    "message": "The file exceeds the configured upload limit.",
    "request_id": "719bb658-cb36-4c6c-a152-701fb2bb19f2"
  }
}
```
*Never returns raw stack traces or internal secrets.*
