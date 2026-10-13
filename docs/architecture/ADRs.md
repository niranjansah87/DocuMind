# Architecture Decision Records (ADRs)

These records distinguish recommended decisions from assignment-mandated
behavior. They should be updated if implementation reveals a better
tradeoff.

## ADR-001 --- Modular monolith

**Status:** Proposed\
**Context:** The deliverable must be easy to run and explain on a clean
machine.\
**Decision:** One FastAPI service with clear internal modules, one
PostgreSQL database, and one Next.js frontend.\
**Alternatives:** Microservices, separate worker service from day one.\
**Rationale:** Fewer containers and failure modes; module boundaries
still support future extraction.\
**Tradeoff:** Ingestion and API scaling are coupled initially.

## ADR-002 --- PostgreSQL + pgvector as system of record

**Status:** Required database; schema choice proposed\
**Decision:** Store document metadata, chunks, embeddings, orders,
tickets, and pending confirmations in PostgreSQL.\
**Rationale:** Matches assignment and reduces operational dependencies.\
**Tradeoff:** Full-text/vector query tuning is more manual than
specialized retrieval platforms.

## ADR-003 --- Configurable external embedding and LLM providers

**Status:** Provider selection open; environment-based secrets required\
**Decision:** Wrap embedding and chat APIs behind provider interfaces
and configure model names through environment variables.\
**Rationale:** Makes model replacement and test fakes straightforward.\
**Tradeoff:** Provider abstraction should remain small and not attempt
to normalize every vendor feature.

## ADR-004 --- Two chunk sizes evaluated independently

**Status:** Required\
**Decision:** Evaluate 300-token and 800-token chunks with the same gold
questions, overlap policy, embedding model, retrieval settings, and
environment wherever possible.\
**Rationale:** Isolates chunk-size impact.\
**Tradeoff:** Tokenizer differences and API variance can affect results;
record exact settings and repeats.

## ADR-005 --- Vector baseline, then hybrid retrieval

**Status:** Assignment asks for both comparison and hybrid addition;
exact final default open\
**Decision:** Implement vector-only baseline first. Add keyword + vector
fusion and a reranker if reliable within the time budget. Compare on the
same test set.\
**Rationale:** Establishes a baseline and shows whether added complexity
improves results.\
**Tradeoff:** Hybrid search and reranking add latency and tuning
parameters.

## ADR-006 --- Explicit router before tool orchestration

**Status:** Proposed implementation\
**Decision:** Use deterministic intent/rule checks for obvious order
identifiers and order intents; use a small LLM classifier only when
needed. Route ordinary document questions directly to RAG.\
**Rationale:** Avoids unnecessary agent latency/cost and reduces
accidental tool use.\
**Tradeoff:** Rules need tests and may require clarification for
ambiguous messages.

## ADR-007 --- Explicit confirmation for ticket writes

**Status:** Required\
**Decision:** `create_ticket` cannot execute from model intent alone. It
requires a pending action and explicit user confirmation tied to that
action.\
**Rationale:** Prevents unintended side effects.\
**Tradeoff:** Adds one interaction round-trip.

## ADR-008 --- SSE for answer streaming

**Status:** Assignment requirement implied by "chat box showing the
streamed answer"; implementation detail proposed\
**Decision:** Use Server-Sent Events unless a concrete need for
WebSockets appears.\
**Rationale:** One-way token/status streaming is simpler than a
bidirectional socket.\
**Tradeoff:** Client reconnect/cancellation semantics need deliberate
handling.

## ADR-009 --- Synchronous bounded ingestion first

**Status:** Proposed\
**Decision:** Process modest-size files in the upload request with
strict limits and visible status. Keep ingestion functions separable so
they can move to a worker later.\
**Rationale:** Fewer services and easiest clean-machine demo.\
**Tradeoff:** Upload duration depends on embedding-provider latency;
background jobs are a future improvement.

## ADR-010 --- No fabricated benchmark results

**Status:** Non-negotiable process rule\
**Decision:** README evaluation tables remain pending until the
evaluation script runs.\
**Rationale:** Credible engineering evidence matters more than
favorable-looking numbers.\
**Tradeoff:** If results are mixed, the report must explain them rather
than hide them.
