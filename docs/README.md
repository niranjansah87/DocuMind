# DocuMind --- Project Documentation

**Purpose:** Documentation-first blueprint for the VanarX Tech take-home
assignment: a document Q&A assistant using retrieval-augmented
generation (RAG) and a bounded tool-using agent.

> **Status:** Core application and benchmark evaluation are implemented. The current
> Compose file requires an external PostgreSQL/pgvector instance, so the assignment's
> clean-clone, one-command acceptance criterion remains pending.

## Start here

1.  [Product Requirements Document](product/PRD.md)
2.  [Software Requirements Specification](product/SRS.md)
3.  [Architecture Overview](architecture/ARCHITECTURE.md)
4.  [Architecture Decision Records](architecture/ADRs.md)
5.  [Data Model](architecture/DATA_MODEL.md)
6.  [API Contract](engineering/API_CONTRACT.md)
7.  [Ingestion and RAG Design](engineering/RAG_DESIGN.md)
8.  [Agent and Tool Design](engineering/AGENT_TOOLS.md)
9.  [Security and Threat Model](engineering/SECURITY.md)
10. [Testing Strategy](engineering/TESTING.md)
11. [Evaluation Protocol](evaluation/EVALUATION.md)
12. [Gold Questions](evaluation/GOLD_QUESTIONS.md)
13. [Frontend UX Specification](engineering/FRONTEND_UX.md)
14. [Deployment and Operations](operations/DEPLOYMENT.md)
15. [Implementation Plan](operations/IMPLEMENTATION_PLAN.md)
16. [Risks and Open Decisions](operations/RISKS.md)

## Assignment acceptance checklist

-   [x] PDF/TXT upload, validation, parsing, document ID response.
-   [x] Chunking with overlap; duplicate uploads do not create duplicate chunks.
-   [x] PostgreSQL + pgvector persistence.
-   [x] Document answers are grounded and cited by document name and chunk.
-   [x] Similarity threshold and explicit abstention for unsupported questions.
-   [x] Metadata/access filters prevent cross-document or cross-user retrieval.
-   [x] Router sends ordinary document questions to RAG and order questions to a tool.
-   [x] Three tools: `search_docs`, `get_order_status`, `create_ticket`.
-   [x] Ticket creation requires explicit confirmation.
-   [x] Tool validation, bounded steps, timeout/retry/backoff, honest failure handling.
-   [x] Primary-model failure can use configured fallback model.
-   [x] Prompt-injection defense treats retrieved text as untrusted data.
-   [x] Multi-page frontend supports 4 reference designs from `design/` (workspace, documents, doc-detail, evaluation).
-   [ ] `docker compose up --build` starts frontend, API and database. **Pending:** the checked-in Compose file currently defines only API and web services.
-   [x] `.env.example`, sample document, seed data and automated tests.
-   [x] 15 gold questions run against 300-token and 800-token chunks.
-   [x] README reports correct-chunk retrieval, context-supported answers and average response time.
-   [x] README states the selected chunk size and evidence for the choice.
-   [ ] Clean-machine walkthrough succeeds with only `.env.example`, an API key, and Docker Compose. **Pending:** Compose-managed database provisioning.

## Scope note

The assignment mentions hybrid retrieval and reranking as a progression:
start with vector search, then add keyword + vector retrieval and a
reranker, and compare results. This implementation measured vector-only
and hybrid RRF retrieval. It did not evaluate a cross-encoder reranker;
that limitation is stated in the README and evaluation report.
