# DocuMind

DocuMind is an end-to-end, document-grounded question-and-answer assistant built for the VanarX Tech full-stack engineering take-home assignment. It integrates a Next.js 16 frontend faithfully reproducing 4 reference designs, a modular FastAPI backend, PostgreSQL with pgvector, an OpenAI-compatible model adapter, and controlled database tools.

> **Candidate Submission Details:**
> - **Candidate:** Bikash Saud (`bikashsaud` / `bikash.saud@vanarxtech.com`)
> - **Evaluation Dataset:** 15 Gold Questions benchmarked across 300 and 800 token chunk sizes.
> - **Primary Command:** `docker compose up --build`

---

## 1. Quick Reviewer Walkthrough (Clean Machine)

A clean machine can evaluate DocuMind end-to-end using the standard 7-step assignment workflow:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bikashsaud/documind.git
   cd documind
   ```

2. **Configure environment variables:**
   ```bash
   # Copy the complete template
   cp .env.example .env
   ```
   Open `.env` and set your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-...your-openai-api-key...
   ```

3. **Start the complete stack with a single command:**
   ```bash
   docker compose up --build
   ```
   This automatically provisions PostgreSQL with `pgvector`, applies Alembic migrations, loads seed orders (`ORD-1001`, `ORD-1002`, `ORD-1003`), and launches the API (port 8888) and Next.js frontend (port 7777).

4. **Upload the sample document:**
   - Open <http://localhost:7777> in your browser.
   - Drag and drop or upload `data/sample_knowledge_document.txt` (or `data/sample_knowledge_document.pdf`).
   - The document is parsed, token-chunked (800 tokens, 50 overlap), embedded, and persisted in pgvector.

5. **Test grounded document Q&A with citations:**
   - Ask: *"What is the return window for an eligible item?"*
   - Verify that the response states **30 days** and provides an interactive citation pill `[1]` linked to the *Returns and Refunds* section.

6. **Test order-tool routing & database lookup:**
   - Ask: *"What is the status of order ORD-1001?"*
   - Verify that the router automatically switches from RAG to the database tool, displaying a purple `Agent Tool` badge and returning the verified database status (`processing`, ordered 2026-03-28, standard shipping).

7. **Test out-of-scope abstention (anti-hallucination):**
   - Ask: *"What is the refund policy for flights to Mars?"*
   - Verify that the system explicitly abstains with:
     > *"I don't know based on the available documents."*

---

## 2. Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js 16 Web Client (Port 7777)                     │
│  4 Reference-Accurate Views: Workspace, Documents, Details, Evaluation │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST / Server-Sent Events (SSE)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Modular Monolith (Port 8888)              │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │     Intent Router     │             │     Ingestion Pipeline     │  │
│  │ (Direct RAG vs Tools) │             │ (PDF/TXT -> tiktoken 800)  │  │
│  └──────────┬────────────┘             └─────────────┬──────────────┘  │
│             │                                        │                 │
│      ┌──────┴──────┐                          ┌──────┴──────┐          │
│      ▼             ▼                          ▼             ▼          │
│  ┌────────┐  ┌───────────┐               ┌─────────┐  ┌──────────────┐ │
│  │ RAG    │  │ Tool DB   │               │ Chunker │  │ OpenAI Embed │ │
│  │ Engine │  │ Execution │               │ 800 tok │  │ 1536-dim     │ │
│  └───┬────┘  └─────┬─────┘               └────┬────┘  └──────┬───────┘ │
│      │             │                          │              │         │
└──────┼─────────────┼──────────────────────────┼──────────────┼─────────┘
       │             │                          │              │
       ▼             ▼                          ▼              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 18 + pgvector Extension                   │
│                                                                        │
│  - documents (metadata, SHA-256 byte hash, owner scope, status)        │
│  - document_chunks (text, pgvector 1536 embeddings, page/section)     │
│  - orders (seeded fictional operational data: ORD-1001..ORD-1003)      │
│  - tickets & pending_actions (two-stage confirmation, 600s TTL)        │
└────────────────────────────────────────────────────────────────────────┘
```

### Core System Invariants
1. **Document Grounding & Anti-Hallucination:** The LLM is restricted to retrieved context excerpts fenced in `<untrusted_context>`.
2. **Citation Allowlist & Server-Side Resolution:** Every citation ID returned by the model must belong to the database-retrieved candidate set. Citation metadata (page number, section title, document name) is resolved strictly from database records, preventing prompt injection or fabricated citations.
3. **No Fabricated Tool Data:** Order lookups query the database directly. If an order number does not exist (`ORD-9999`), the system returns `found: false` and explicitly indicates the order was not found.
4. **Two-Stage Human-in-the-Loop Action Confirmation:** Mutating operations (`create_ticket`) prepare an ephemeral pending action with a 600-second TTL. The action is executed only upon explicit client confirmation and enforces replay protection (`409 CONFIRMATION_ALREADY_USED`).
5. **Byte-Hash Deduplication:** Uploads are hashed using SHA-256. Duplicate files within the same owner scope immediately reuse existing indexed chunks without redundant LLM embedding costs.

---

## 3. Key Technical Decisions & Tradeoffs

| Decision | Chosen Approach | Alternative Considered | Tradeoff & Justification |
| :--- | :--- | :--- | :--- |
| **Storage & Vectors** | PostgreSQL + `pgvector` | Dedicated Vector DB (Pinecone, Qdrant, Milvus) | **Simplicity & ACID guarantees:** Eliminates dual-write synchronization issues and extra network hops. Relational data (orders, tickets, documents) and vector embeddings share a single transactional boundary. |
| **Retrieval Architecture** | Hybrid RRF (Vector Cosine + FTS `ts_rank_cd`) | Pure Vector Search | **Lexical precision:** Vector search excels at semantic paraphrasing but often misses exact alphanumeric identifiers, policy codes, and technical jargon. Reciprocal Rank Fusion (RRF) gives the best of both worlds, achieving 100% recall. |
| **Intent Routing** | Deterministic Regex & Pattern Router | LLM-as-a-Router / Function Calling Agent | **Latency & Cost:** Routing simple queries deterministically takes `<1ms` and costs `$0.00`. An LLM-based router adds 300–800ms of latency and non-deterministic misrouting risk. |
| **Action Confirmation** | Ephemeral Two-Stage Tokens (`prepare` → `confirm`) | Autonomous Tool Execution | **Safety & Auditability:** LLMs should never autonomously trigger mutating side-effects without explicit human verification. Cryptographic single-use tokens prevent unintended writes and replay attacks. |
| **Citation Security** | Server-Side Allowlist & Record Lookup | LLM-Generated Citation Labels | **Prompt Injection Defense:** Untrusted document text could manipulate the model into inventing citations. In DocuMind, the LLM only outputs candidate UUIDs; the backend verifies membership and enriches metadata directly from PostgreSQL. |
| **API Contract** | Server-Sent Events (SSE) with Typed Events | WebSockets or Long Polling | **Connection efficiency:** SSE is unidirectional, lightweight, operates over standard HTTP/1.1 and HTTP/2, traverses corporate proxies effortlessly, and allows native browser reconnection. |

---

## 4. Why Not Use an Agent for Everything?

A common anti-pattern in modern AI development is wrapping every user interaction in an autonomous agent loop (e.g. ReAct / LangChain AgentExecutor). In DocuMind, simple document questions bypass the agent loop and execute through direct RAG. Here is why:

1. **Latency & Time-to-First-Token (TTFT):**
   - **Direct RAG:** Single vector query + single LLM call. Streaming tokens begin in **~200–400 ms**.
   - **Autonomous Agent:** Requires reasoning step (`Thought`), tool selection (`Action`), tool execution, observation parsing, and final response synthesis. This multi-turn LLM loop increases latency to **2,000–5,000 ms**, degrading conversational responsiveness.

2. **Cost Predictability:**
   - Plain RAG incurs exactly one embedding call and one completion call.
   - An open-ended agent can execute multiple exploratory iterations, consuming 3× to 6× more tokens per user question.

3. **Deterministic Safety vs. Non-Deterministic Hallucinations:**
   - For informational Q&A, users want answers strictly grounded in documents. Autonomous agents risk "reasoning drift" or hallucinating synthetic tool calls when document context is ambiguous.
   - For database lookups and ticket creation, deterministic validation ensures operations adhere to strict schema constraints, authorization scopes, and human confirmations.

4. **Operational Reliability:**
   - Agent loops can enter infinite recursion or fail to terminate when tools return unexpected payloads. Direct routing bounds maximum execution steps and execution time deterministically.

---

## 5. Evaluation Results (300 vs 800 Tokens)

The 15-question gold evaluation dataset is formally defined in [`docs/evaluation/GOLD_QUESTIONS.md`](docs/evaluation/GOLD_QUESTIONS.md). Real evaluation runs were executed against `text-embedding-3-small` (1536 dimensions) using both Vector-only and Hybrid RRF retrieval. Results are logged in [`evaluation/results/latest.json`](evaluation/results/latest.json):

| Metric | 300 Tokens (Vector) | 300 Tokens (Hybrid) | 800 Tokens (Vector) | 800 Tokens (Hybrid) |
| :--- | :---: | :---: | :---: | :---: |
| **Questions Tested** | 15 | 15 | 15 | 15 |
| **Retrieval Recall@k** | 100% (15/15) | 100% (15/15) | 100% (15/15) | **100% (15/15)** |
| **Context-Supported Answers** | 93.3% (14/15) | 93.3% (14/15) | 60.0% (9/15) | **100% (15/15)** |
| **Citation-Valid Answers** | 93.3% (14/15) | 93.3% (14/15) | 60.0% (9/15) | **100% (15/15)** |
| **Mean Latency (ms)** | 1,858 ms | 1,757 ms | 1,673 ms | **1,591 ms** |
| **Median Latency (ms)** | 1,760 ms | 1,600 ms | 1,406 ms | **1,551 ms** |
| **Failed / Errored Requests** | 0 | 0 | 0 | **0** |

### Chunk Size Selection Rationale

**Decision:** **800 Tokens with Hybrid RRF Retrieval** is selected for the final production implementation.

**Why 800 Tokens Outperforms 300 Tokens:**
1. **Semantic Completeness & Policy Cohesion:** Legal and customer support policies contain compound conditions (e.g. warranty coverage qualifications, exclusions, and claims procedures). A 300-token window frequently splits conditional clauses across chunk boundaries, requiring multiple retrieved chunks to synthesize an answer. 800 tokens keeps complete policy sections intact.
2. **Superior Accuracy (100% vs 93.3%):** 800 tokens with Hybrid RRF achieved **15/15 (100%) context-supported and citation-valid answers**, resolving questions where smaller chunks left context gaps.
3. **Reduced Latency (1,591 ms vs 1,757 ms):** Larger chunks result in fewer total documents to rank and fewer disjoint context segments in the LLM prompt, yielding faster generation times.

---

## 6. What We Would Improve Next

If given additional engineering cycles, the following high-impact improvements would be prioritized:

1. **Two-Stage Re-ranking:** Introduce a lightweight cross-encoder (e.g., `bge-reranker-large` or Cohere Rerank) after Hybrid RRF to boost precision when scaling to tens of thousands of documents.
2. **Asynchronous Background Task Queue:** Offload heavy PDF parsing, OCR, and embedding generation to an asynchronous worker queue (Celery or ARQ with Redis) with real-time WebSocket/SSE progress updates.
3. **Scanned PDF & Multimodal OCR:** Integrate a multimodal OCR pipeline (e.g. `pdf2image` + `marker` or Vision LLM) to accurately extract text from scanned PDFs, image receipts, and complex data tables.
4. **Multi-Turn Conversation Memory:** Add session-based sliding-window conversation history with query rewriting to handle anaphoric follow-up questions (e.g., *"What about for damaged items?"*).
5. **Organizational Multi-Tenancy & RBAC:** Implement team-based workspace isolation with role-based access control (Admin, Member, Viewer) and document-level permission tags.

---

## 7. Automated Testing & Verification Suite

DocuMind enforces automated test coverage across chunking, retrieval, and tool-failure scenarios:

### Running Backend Tests (pytest, ruff, mypy)
```bash
# Run the 26 automated unit and integration tests
uv run --directory apps/api pytest

# Run fast code linting
uv run --directory apps/api ruff check app tests

# Run strict static type checking (56 source files)
uv run --directory apps/api mypy app tests
```
*Current Status: 26 passed, 0 lint errors, 0 mypy type errors.*

### Running Frontend Tests & Typecheck
```bash
cd apps/web

# Strict TypeScript verification
npm run typecheck

# ESLint audit
npm run lint

# Production Turbopack build
npm run build
```
*Current Status: 0 type errors, 0 lint warnings, 5/5 routes successfully compiled.*

### Test Coverage Highlights
- **Chunking (`tests/test_chunker.py`):** Token order preservation, boundary overlap verification, invalid parameter rejection, and section/page metadata mapping.
- **Retrieval (`tests/test_search_docs.py`):** Ownership scoping, top-k limiting, and citation metadata extraction.
- **Tool Failure (`tests/test_tools.py`):** Database connection failure and graceful exception transformation without tracebacks.
- **Guardrails (`tests/test_guardrails.py`):** Ticket confirmation expiration, duplicate upload deduplication, and replay attack rejection.

---

## 8. Frontend Implementation: 4 Reference Designs

The Next.js 16 frontend located in `apps/web/` faithfully reproduces the 4 design mockups in `design/`:

1. **Workspace & Chat View (`design/Documind_workspace.png` → `/`):**
   - Left navigation drawer with brand icon, session history, and workspace links.
   - Conversational chat area with streamed Markdown, model/route indicator badges (`RAG`, `Agent Tool`), and inline citation pills (`[1]`).
   - Right Source Inspector panel showing active chunk quotes, page numbers, and section headers.
   - Interactive Ticket Confirmation Modal for two-stage approval.

2. **Documents Repository (`design/documind_documents_page.png` → `/documents`):**
   - Top drag-and-drop upload banner with validation and status indicators.
   - Status filter pills (`All`, `Ready`, `Processing`, `Failed`).
   - Sortable documents table with chunk counts, file sizes, and download actions.
   - Slide-out details drawer with raw chunk inspection.

3. **Document Details & Excerpt Inspector (`design/documind_documents_details_page.png` → `/documents/[id]`):**
   - Page thumbnail rail with navigation controls.
   - Central document reader canvas with interactive excerpt highlights.
   - Chunk metadata sidebar detailing token counts and embedding dimensions.

4. **Evaluation & Benchmark Dashboard (`design/documind_evaluation_page.png` → `/evaluation`):**
   - KPI comparison cards (Retrieval Recall, Context Support, Mean Latency).
   - SVG performance visualizer charts.
   - Complete 15 Gold Questions interactive evaluation table.
   - Benchmark insights and chunk size trade-off analysis sidebar.

---

## 9. Documentation Index

Comprehensive engineering documentation is maintained in the `docs/` directory:

- [Product Requirements Document (PRD)](docs/product/PRD.md)
- [System Requirements Specification (SRS)](docs/product/SRS.md)
- [System Architecture](docs/architecture/ARCHITECTURE.md)
- [Architecture Decision Records (ADRs)](docs/architecture/ADRs.md)
- [Data Model & Database Schema](docs/architecture/DATA_MODEL.md)
- [API Contract Specification](docs/engineering/API_CONTRACT.md)
- [Frontend UX & Design System](docs/engineering/FRONTEND_UX.md)
- [RAG & Ingestion Design](docs/engineering/RAG_DESIGN.md)
- [Agent & Tools Guardrails](docs/engineering/AGENT_TOOLS.md)
- [Security & Threat Model](docs/engineering/SECURITY.md)
- [Testing Strategy & Test Plan](docs/engineering/TESTING.md)
- [Evaluation Protocol & Measurements](docs/evaluation/EVALUATION.md)
- [15 Gold Questions Dataset](docs/evaluation/GOLD_QUESTIONS.md)
- [Operations & Deployment Guide](docs/operations/DEPLOYMENT.md)
- [Implementation Plan & Definition of Done](docs/operations/IMPLEMENTATION_PLAN.md)
- [Risk Register](docs/operations/RISKS.md)

---
*Developed for VanarX Tech by Candidate Bikash Saud.*
