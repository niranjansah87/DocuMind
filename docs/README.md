# DocuMind --- Project Documentation

**Purpose:** Documentation-first blueprint for the VanarX Tech take-home
assignment: a document Q&A assistant using retrieval-augmented
generation (RAG) and a bounded tool-using agent.

> **Status:** Planning baseline. This package documents the requirements
> and a proposed implementation. It does not claim that the application
> has been scaffolded, implemented, deployed, or benchmarked.

## Start here

1.  [Product Requirements Document](docs/product/PRD.md)
2.  [Software Requirements Specification](docs/product/SRS.md)
3.  [Architecture Overview](docs/architecture/ARCHITECTURE.md)
4.  [Architecture Decision Records](docs/architecture/ADRs.md)
5.  [Data Model](docs/architecture/DATA_MODEL.md)
6.  [API Contract](docs/engineering/API_CONTRACT.md)
7.  [Ingestion and RAG Design](docs/engineering/RAG_DESIGN.md)
8.  [Agent and Tool Design](docs/engineering/AGENT_TOOLS.md)
9.  [Security and Threat Model](docs/engineering/SECURITY.md)
10. [Testing Strategy](docs/engineering/TESTING.md)
11. [Evaluation Protocol](docs/evaluation/EVALUATION.md)
12. [Gold Questions](docs/evaluation/GOLD_QUESTIONS.md)
13. [Frontend UX Specification](docs/engineering/FRONTEND_UX.md)
14. [Deployment and Operations](docs/operations/DEPLOYMENT.md)
15. [Implementation Plan](docs/operations/IMPLEMENTATION_PLAN.md)
16. [Risks and Open Decisions](docs/operations/RISKS.md)
17. [Sample Knowledge Document](data/sample_knowledge_document.md)
18. [Sample Order Seed Data](data/sample_orders.json)

## Source-of-truth conventions

-   **Assignment requirement** means explicitly required in the supplied
    VanarX take-home brief.
-   **Proposed decision** means a recommended implementation choice that
    should be validated while scaffolding.
-   **Open decision** means it should not be represented as settled
    until implementation or a deliberate decision.
-   Evaluation values are intentionally blank until tests are run. Do
    not invent latency or accuracy results.

## Assignment acceptance checklist

-   [ ] PDF/TXT upload, validation, parsing, document ID response.
-   [ ] Chunking with overlap; duplicate uploads do not create duplicate
    chunks.
-   [ ] PostgreSQL + pgvector persistence.
-   [ ] Document answers are grounded and cited by document name and
    chunk.
-   [ ] Similarity threshold and explicit abstention for unsupported
    questions.
-   [ ] Metadata/access filters prevent cross-document or cross-user
    retrieval.
-   [ ] Router sends ordinary document questions to RAG and order
    questions to a tool.
-   [ ] Three tools: `search_docs`, `get_order_status`, `create_ticket`.
-   [ ] Ticket creation requires explicit confirmation.
-   [ ] Tool validation, bounded steps, timeout/retry/backoff, honest
    failure handling.
-   [ ] Primary-model failure can use configured fallback model.
-   [ ] Prompt-injection defense treats retrieved text as untrusted
    data.
-   [ ] Single-page frontend supports upload, chat, citations,
    loading/error/retry.
-   [ ] `docker compose up --build` starts frontend, API and database.
-   [ ] `.env.example`, sample document, seed data and automated tests.
-   [ ] 15 gold questions run against 300-token and 800-token chunks.
-   [ ] README reports correct-chunk retrieval, context-supported
    answers and average response time.
-   [ ] README states the selected chunk size and evidence for the
    choice.
-   [ ] Clean-machine walkthrough succeeds.

## Scope note

The assignment mentions hybrid retrieval and reranking as a progression:
start with vector search, then add keyword + vector retrieval and a
reranker, and compare results. The proposed plan implements vector-only
as a baseline and hybrid retrieval as the comparison/final candidate if
time and measured quality justify it.
