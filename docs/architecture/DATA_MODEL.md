# Data Model

## 1. Principles

-   PostgreSQL is the source of truth for operational data.
-   Every user-owned resource should carry an ownership/scope key, even
    if the demo seeds a single demo user.
-   Database constraints, not only application checks, enforce
    uniqueness and referential integrity.
-   Never accept a user/tenant scope from an untrusted model-generated
    tool argument; derive it from authenticated request context.
-   Use migrations for schema changes and seed scripts for repeatable
    demo data.

## 2. Schema inventory

### `users` (not implemented)

-   `id UUID PRIMARY KEY`
-   `email TEXT UNIQUE` (if authentication is implemented)
-   `created_at TIMESTAMPTZ`

### `documents`

-   `id UUID PRIMARY KEY`
-   `owner_id UUID NOT NULL`
-   `filename TEXT NOT NULL`
-   `content_sha256 CHAR(64) NOT NULL`
-   `mime_type TEXT NOT NULL`
-   `byte_size BIGINT NOT NULL`
-   `status TEXT CHECK (status IN ('processing','ready','failed'))`
-   `page_count INTEGER NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   Unique constraint on `(owner_id, content_sha256)` to deduplicate
    within scope.

### `document_chunks`

-   `id UUID PRIMARY KEY`
-   `document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE`
-   `chunk_index INTEGER NOT NULL`
-   `text TEXT NOT NULL`
-   `token_count INTEGER NOT NULL`
-   `section_title TEXT NULL`
-   `page_start INTEGER NULL`
-   `page_end INTEGER NULL`
-   `embedding VECTOR(1536) NOT NULL`
-   `embedding_model TEXT NOT NULL`
-   `chunk_size_tokens INTEGER NOT NULL`
-   `overlap_tokens INTEGER NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   Unique constraint
    `(document_id, chunk_index, chunk_size_tokens, overlap_tokens)`.

**Important:** PostgreSQL vector dimensions are fixed per vector
column/index. If evaluation requires storing both chunk configurations
simultaneously, either (a) include chunk configuration in a table with
one known embedding dimension and uniqueness keys, or (b) use separate
evaluation runs/tables. Do not mix vectors of different embedding
dimensions in one column. Prefer one embedding model/dimension across
both chunk sizes.

### `orders`

-   `id UUID PRIMARY KEY`
-   `owner_id UUID NOT NULL`
-   `order_number TEXT NOT NULL`
-   `status TEXT NOT NULL`
-   `items JSONB NOT NULL DEFAULT '[]'`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   Unique constraint on `(owner_id, order_number)`.

### `support_tickets`

-   `id UUID PRIMARY KEY`
-   `owner_id UUID NOT NULL`
-   `order_id UUID NULL REFERENCES orders(id)`
-   `subject TEXT NOT NULL`
-   `description TEXT NOT NULL`
-   `status TEXT NOT NULL DEFAULT 'open'`
-   `idempotency_key TEXT NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   Unique constraint on `(owner_id, idempotency_key)`.

### `pending_actions`

-   `id UUID PRIMARY KEY`
-   `owner_id UUID NOT NULL`
-   `action_type TEXT NOT NULL`
-   `payload JSONB NOT NULL`
-   `confirmation_token_hash TEXT NOT NULL`
-   `expires_at TIMESTAMPTZ NOT NULL`
-   `consumed_at TIMESTAMPTZ NULL`
-   `created_at TIMESTAMPTZ NOT NULL`

### `evaluation_runs` / `evaluation_results` (optional but useful)

Store run ID, configuration snapshot, question ID, expected source
chunk/section, retrieved chunk IDs, supported flag, latency, error and
strategy. Avoid storing sensitive content unnecessarily.

## 3. Vector indexing

-   Enable `vector` extension during initialization/migration.
-   Use cosine distance or inner product consistently with the embedding
    model's normalization behavior.
-   Add an appropriate pgvector index (HNSW or IVFFlat) only if the
    dataset/extension version supports it and it provides measurable
    benefit. For a tiny sample, exact scan may be sufficient and
    simpler.
-   Filter by allowed document IDs/owner scope before ranking, or ensure
    the SQL query applies those filters in the same retrieval operation.
-   Confirm index operator class matches the distance operator.

## 4. Transaction boundaries

-   Document row creation and chunk persistence should not leave a
    document marked `ready` if embedding/persistence fails.
-   Duplicate check should be backed by a unique constraint to prevent
    races.
-   Ticket creation and pending-action consumption should be atomic
    where possible.
-   Tool retries for writes require idempotency; never retry a
    non-idempotent write blindly.
