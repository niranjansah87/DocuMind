# API Contract (Proposed)

Base path: `/api/v1`. This is a proposed contract to implement; adjust
only deliberately and keep frontend, tests and README in sync.

## 1. Health

### `GET /health`

Returns process liveness.

``` json
{"status":"ok"}
```

### `GET /ready`

Checks database connectivity and required extensions/configuration.

``` json
{"status":"ready","dependencies":{"database":"ok"}}
```

Return 503 if not ready.

## 2. Upload document

### `POST /documents`

Content type: `multipart/form-data`, field `file`. Accepted: PDF and
TXT; maximum size configured by `MAX_UPLOAD_BYTES`. Success `201`:

``` json
{
  "document_id": "uuid",
  "filename": "sample_guide.pdf",
  "status": "ready",
  "duplicate": false,
  "chunk_count": 12
}
```

A duplicate may return `200` with the existing document ID and
`duplicate: true`; document the chosen behavior and test it
consistently.

Errors: `413` too large, `415` unsupported type, `422` empty/unparseable
content, `503` embedding/provider unavailable, `500` only for unexpected
internal failures with generic user-facing text and request ID.

## 3. List documents

### `GET /documents`

Returns only documents in the caller's permitted scope.

``` json
{"items":[{"document_id":"uuid","filename":"sample_guide.pdf","status":"ready","created_at":"ISO-8601"}]}
```

## 4. Chat (SSE preferred for final UX)

### `POST /chat`

Request:

``` json
{
  "message": "How many days do I have to return an item?",
  "document_ids": ["uuid"],
  "conversation_id": "optional-uuid"
}
```

SSE events should be versioned/documented. Suggested event sequence: -
`event: status` --- route and stage, no private data. - `event: token`
--- partial answer text. - `event: citations` --- validated citation
objects. - `event: done` --- final metadata and usage/latency. -
`event: error` --- safe error code/message and request ID.

If implementing non-streaming JSON for testability, provide `POST /chat`
JSON or a clearly named `/chat/completions` endpoint and make the
frontend's streaming behavior explicit. Avoid returning a mixture of
JSON and SSE on the same route without negotiation.

Final response shape:

``` json
{
  "answer": "Items can be returned within 30 days of delivery.",
  "route": "rag",
  "abstained": false,
  "citations": [
    {
      "document_id": "uuid",
      "document_name": "sample_guide.pdf",
      "chunk_id": "uuid",
      "chunk_index": 3,
      "section": "Returns",
      "page_start": 2,
      "page_end": 2,
      "quote": "Items may be returned within 30 days of delivery."
    }
  ],
  "latency_ms": 842
}
```

Citation quote must be a substring or otherwise verifiably grounded in
the retrieved source. Never accept arbitrary citation IDs from model
output.

## 5. Order lookup

### `POST /tools/order-status` (or internal agent tool exposed through chat)

Request:

``` json
{"order_number":"ORD-1002"}
```

Success:

``` json
{"found":true,"order_number":"ORD-1002","status":"shipped","items":["Wireless keyboard"],"updated_at":"ISO-8601"}
```

Not found: return a clear not-found result, not a fabricated status. In
production, authorize the caller against order ownership.

The assignment specifically expects order-related chat to use the
required tool. The UI does not need to expose a separate tools page;
tool usage can be shown in chat metadata/logs for reviewer verification.

## 6. Ticket creation and confirmation

### `POST /tickets/prepare`

Request:

``` json
{"subject":"Delivery delay","description":"The parcel has not arrived.","order_number":"ORD-1002"}
```

Response:

``` json
{
  "confirmation_required": true,
  "pending_action_id": "uuid",
  "summary": "Create a ticket about a delivery delay for ORD-1002.",
  "expires_at": "ISO-8601"
}
```

### `POST /tickets/confirm`

Request:

``` json
{"pending_action_id":"uuid","confirmed":true}
```

Response on success:

``` json
{"created":true,"ticket_id":"uuid","ticket_number":"TKT-1001","status":"open"}
```

Reject expired, already consumed, missing, mismatched, or unconfirmed
actions. Use idempotency protection.

## 7. Error schema

``` json
{
  "error": {
    "code": "DOCUMENT_TOO_LARGE",
    "message": "The file exceeds the configured upload limit.",
    "request_id": "uuid"
  }
}
```

## 8. API invariants

-   Never return stack traces or provider secrets to clients.
-   Citation references must map to chunks retrieved for this request
    and authorized scope.
-   Order status must originate from the database tool result.
-   Ticket writes require confirmation.
-   User-provided `document_ids` must be checked against the caller's
    access scope.
