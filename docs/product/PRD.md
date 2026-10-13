# DocuMind - Product Requirements Document (PRD)

**Document status:** Product baseline for implementation  
**Version:** 1.0  
**Product:** DocuMind - Document Q&A Assistant with RAG and an Agent  
**Primary stakeholder:** VanarX Tech take-home assignment reviewer  
**Intended readers:** Candidate/engineer, coding agents, reviewers, future maintainers  
**Source of mandatory requirements:** `vanarX_candidate_task.docx` supplied for this assignment  
**Implementation status:** Core application and benchmark implemented. FR-026 (database, API and frontend from one Compose command on a clean clone) remains pending because the current Compose file omits the database service. A cross-encoder reranker was not evaluated.

> **Interpretation rule:** “Required” means explicitly requested by the assignment. “Recommended” means a design choice proposed to make the system reliable. Open decisions must not be presented as implemented facts. Evaluation metrics must be measured, never fabricated.

---

## 1. Executive summary

DocuMind is a web application where a user uploads a PDF or text document and asks questions about its content. The system extracts text, chunks it with overlap, creates embeddings, stores chunks and vectors in PostgreSQL with pgvector, retrieves evidence for a question, and generates an answer with citations. It must refuse to invent an answer when the document evidence is insufficient.

The application also supports operational questions about orders. Order questions must be routed to a database-backed tool rather than answered from document text or model intuition. A ticket-creation tool must be available, but because it changes state, it must require explicit user confirmation before creating a ticket.

The assignment emphasizes an end-to-end project that runs from one Docker Compose command, has a clear architecture, includes meaningful automated tests, and reports a reproducible comparison of 300-token and 800-token chunk sizes using 15 gold questions.

The product should demonstrate engineering judgment: direct RAG for simple questions, a bounded tool path for operational tasks, explicit validation at trust boundaries, honest failure behavior, and evidence-based retrieval decisions.

## 2. Product vision and principles

### 2.1 Vision
Provide a small, trustworthy document assistant that can explain where its answers came from and distinguish document knowledge from operational data.

### 2.2 Product principles
1. **Evidence before fluency:** an answer is only useful if supported by retrieved source text.
2. **Citations are verifiable data:** citation identity and metadata come from the database, not model invention.
3. **Unknown is a valid result:** when evidence is insufficient, say so rather than guessing.
4. **Tools are explicit capabilities:** order status comes from the database tool; side effects require confirmation.
5. **Least complexity that meets requirements:** prefer a modular monolith and avoid unnecessary infrastructure.
6. **Reproducible evaluation:** document the dataset, configuration, scoring rules and actual outcomes.
7. **Safe failure:** provider/database/tool errors should be understandable and should never be converted into fabricated success.
8. **Clean-machine usability:** setup and demo must work from documented steps with only environment configuration.

## 3. Problem statement

A general-purpose chatbot can produce plausible but unsupported answers, cite nonexistent passages, confuse a policy document with live order data, or claim a tool action succeeded when the underlying service failed. A reviewer also needs to be able to start and test a project without undocumented manual setup.

DocuMind addresses these risks by separating ingestion, retrieval, answer generation, route selection, and database-backed tools. It makes source evidence visible and uses conservative behavior for unsupported questions and failures.

## 4. Goals

### 4.1 Must-achieve goals
- Upload PDF and TXT files through a frontend/API.
- Validate upload type and size and return a stable document ID.
- Parse documents, chunk text with overlap, create embeddings, and persist chunks/vectors in PostgreSQL + pgvector.
- Re-uploading identical content within the applicable ownership scope must not create duplicate chunks.
- Answer document questions using retrieved context only and include document name plus chunk citation.
- Refuse unsupported questions with an explicit “I don't know” response.
- Filter retrieval by document and authorization scope so inaccessible documents are not exposed.
- Route order questions through a database-backed `get_order_status` tool.
- Implement `search_docs`, `get_order_status`, and `create_ticket`.
- Require confirmation before ticket creation.
- Bound tool execution and handle tool/provider failures honestly.
- Provide model fallback when the primary generation model has a retryable timeout/error and a fallback is configured.
- Deliver a frontend with upload, chat/streaming, citations, loading/error/retry states.
- Start frontend, API, and database with `docker compose up --build`.
- Include `.env.example`, sample document, seed data, automated tests and detailed README.
- Run 15 gold questions using 300-token and 800-token chunks and report actual metrics.

### 4.2 Supporting goals
- Compare vector-only retrieval with hybrid keyword + vector retrieval.
- Add reranking if it can be implemented and evaluated reliably within the assignment window.
- Measure retrieval, generation and total latency.
- Keep provider-specific code behind small interfaces to simplify testing and model changes.

## 5. Non-goals

The initial submission is not intended to be:
- A multi-tenant commercial SaaS with a full identity provider and enterprise admin console.
- A distributed microservice platform.
- A production-scale ingestion queue or streaming data pipeline.
- A universal PDF parser with OCR for every scanned document.
- A perfect RAG benchmark across arbitrary corpora.
- An autonomous agent that handles every request.
- A guarantee that an LLM never hallucinates; the goal is to constrain, detect and safely handle unsupported outputs.
- A production security certification or compliance claim.
- A source of real order, payment or customer data; fixtures should be synthetic.

## 6. Stakeholders and personas

### 6.1 Primary stakeholder: assignment reviewer
Needs to clone the repository, configure an API key, start the stack, upload a sample document, ask three classes of questions, and inspect whether the system behaves correctly.

### 6.2 Persona A: document question asker
Needs an answer from uploaded content and enough citation metadata to verify it.

**Success:** answer is supported by retrieved chunks and citations point to those exact chunks.

### 6.3 Persona B: order support requester
Needs current order status from operational data, not from an uploaded document.

**Success:** the route uses `get_order_status`, and output fields match the database result.

### 6.4 Persona C: ticket requester
Needs to create a support ticket but should see and confirm the proposed action first.

**Success:** no ticket is written before explicit confirmation; confirmed writes return a ticket identifier.

### 6.5 Persona D: maintainer/developer
Needs modular code, clear configuration, meaningful tests, reproducible evaluation, and errors that can be diagnosed without exposing secrets.

## 7. Core user journeys

### Journey A - First-run reviewer workflow
1. Clone the repository.
2. Copy `.env.example` to `.env`.
3. Add the required LLM/embedding API key(s).
4. Run `docker compose up --build`.
5. Open the documented frontend URL.
6. Upload the provided sample document.
7. Ask a question answered by the sample document.
8. Verify that the answer includes a valid citation.
9. Ask about a seeded order and verify that the database tool is called.
10. Ask an out-of-scope question and verify abstention.

**Pass condition:** all steps work without manual database setup or undocumented configuration.

### Journey B - Successful document ingestion
1. User chooses a PDF or TXT file.
2. UI displays allowed types and maximum size.
3. API validates the file.
4. System calculates content hash and checks duplicate scope.
5. Parser extracts text and source metadata.
6. Chunker creates overlapping chunks.
7. Embedding provider generates vectors.
8. PostgreSQL stores document and chunk records.
9. UI shows document as ready and allows it to be selected for chat.

### Journey C - Duplicate upload
1. User uploads the same file twice in the same scope.
2. Server identifies the same content hash.
3. Server returns the existing document identity or another documented idempotent response.
4. No duplicate chunks are created.

### Journey D - Grounded document answer
1. User asks a question.
2. Router selects the direct RAG path.
3. Retriever searches only allowed documents.
4. Relevance policy determines whether evidence is sufficient.
5. Generator answers only from retrieved excerpts.
6. Citation validator checks each citation ID against the retrieved set.
7. API streams or returns the answer and trusted citation metadata.
8. UI displays the answer and expandable citation details.

### Journey E - Unsupported question
1. User asks for information absent from selected documents.
2. Retrieval produces no sufficiently relevant evidence, or evidence does not support the requested fact.
3. System returns a concise unknown response.
4. System does not generate unsupported factual claims or false citations.

### Journey F - Order status
1. User asks an order-related question, ideally with an order number.
2. Router selects the order tool path.
3. Server validates the order number and request scope.
4. `get_order_status` queries PostgreSQL.
5. System reports the returned status, a clear not-found result, or an honest temporary failure.
6. It does not answer from RAG as a substitute for the order tool.

### Journey G - Ticket creation
1. User asks to create a ticket.
2. System gathers required subject/description and optional order reference.
3. Server validates fields.
4. System prepares a pending action and displays a summary.
5. User explicitly confirms that pending action.
6. Server verifies token/action ownership, expiry and unused state.
7. Ticket is created once using idempotency protection.
8. UI displays the ticket ID and status.

### Journey H - Tool/provider failure
1. Tool or model call fails.
2. Retry occurs only for eligible transient failures and within the request deadline.
3. Primary model fallback is attempted if configured and appropriate.
4. If the operation still fails, the API returns a safe error/assistant message.
5. No invented order status, false ticket success, or stack trace is returned.

## 8. Functional requirements

Priority definitions:
- **P0:** required for the reviewer walkthrough or explicitly mandatory.
- **P1:** explicitly described or strongly expected; implement after core path if time is constrained, and disclose any omission.
- **P2:** useful improvement beyond the minimum submission.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-001 | PDF/TXT upload | P0 | Valid file receives a document ID and ingestion status. |
| FR-002 | Upload validation | P0 | Unsupported, empty, too-large and unparseable files receive clear 4xx errors. |
| FR-003 | Text extraction | P0 | Parser extracts usable text; page/section metadata retained when feasible. |
| FR-004 | Overlapping chunking | P0 | Chunker uses configurable target and overlap, preserves ordering and emits non-empty chunks. |
| FR-005 | Embeddings | P0 | One selected embedding model is used consistently for query and document vectors. |
| FR-006 | pgvector persistence | P0 | Chunks and vectors persist in PostgreSQL and are retrievable. |
| FR-007 | Duplicate protection | P0 | Identical file in same scope does not create duplicate chunks, including concurrent upload attempts. |
| FR-008 | Grounded RAG | P0 | Answer generation is restricted to supplied evidence. |
| FR-009 | Citation output | P0 | Factual answers return document name and chunk reference; metadata resolves server-side. |
| FR-010 | Relevance threshold | P0 | Weak/no evidence causes abstention. Threshold is configured and evaluated. |
| FR-011 | Metadata/access filtering | P0 | Retrieval SQL filters by selected document and authorized scope before text reaches the LLM. |
| FR-012 | Direct RAG route | P0 | Ordinary document questions bypass the agent/tool orchestrator. |
| FR-013 | `search_docs` tool | P0 | Typed tool returns authorized document evidence. |
| FR-014 | `get_order_status` tool | P0 | Order request queries seeded/database records and returns real result. |
| FR-015 | `create_ticket` tool | P0 | Ticket creation is a confirmed two-step operation. |
| FR-016 | Tool argument validation | P0 | Invalid tool arguments are rejected before execution. |
| FR-017 | Tool step budget | P0 | Orchestrator stops after configured maximum steps. |
| FR-018 | Timeout/retry/backoff | P0 | Calls have timeouts and bounded retries for transient failures. |
| FR-019 | Honest tool failure | P0 | Tool failure yields an honest response and never fabricates a result. |
| FR-020 | Prompt-injection defense | P0 | Retrieved content cannot change system/tool policy or authorization. |
| FR-021 | Model fallback | P1 | Configured fallback is used for eligible primary generation failures. |
| FR-022 | Hybrid retrieval | P1 | Keyword and vector retrieval are combined and compared with baseline. |
| FR-023 | Reranker | P1 | Reranker applied to bounded candidate set if implemented; results/latency compared. |
| FR-024 | Streaming answer | P0 | Frontend renders streamed answer and final validated citations. |
| FR-025 | Loading/error/retry | P0 | UI exposes relevant states and supports safe retry. |
| FR-026 | Docker Compose | P0 | One command starts API, database and frontend on clean machine. |
| FR-027 | Environment example | P0 | All variables used by code and Compose are documented with safe placeholders. |
| FR-028 | Sample fixtures | P0 | Sample document and order seed allow immediate testing. |
| FR-029 | Automated tests | P0 | Chunking, retrieval and at least one tool-failure case are covered. |
| FR-030 | 15-question evaluation | P0 | All questions run at both chunk sizes and README contains measured results. |
| FR-031 | Architecture/decision docs | P0 | README describes architecture, key decisions/tradeoffs and future improvements. |
| FR-032 | Clean error contract | P0 | API does not expose traceback, keys or internal provider details. |
| FR-033 | Request observability | P1 | Request ID and stage durations aid debugging without logging sensitive content. |
| FR-034 | Document list/delete | P2 | Optional convenience, only if it does not endanger required workflow. |

## 9. Detailed behavior requirements

### 9.1 Upload and ingestion
- Allowed extensions: PDF and TXT.
- Do not trust filename extension alone; validate MIME/signature where practical.
- Maximum size is configuration-driven; the implemented default is 10 MiB.
- Reject empty file and extracted content with no meaningful text.
- Hash original bytes using SHA-256.
- Deduplicate within ownership scope, not globally across users, to avoid revealing that another user uploaded identical content.
- Persist status such as `processing`, `ready`, or `failed`.
- Do not mark document ready until chunk/vector persistence succeeds.
- Failures should not leave partial chunks or a false ready state.
- A scanned PDF without extractable text may be rejected with a clear message; OCR is not required unless deliberately added.

### 9.2 Chunking
- Compare target sizes of 300 and 800 tokens.
- Use the same overlap for the primary comparison; the implemented value is 50 tokens.
- Use a consistent tokenizer/chunking algorithm.
- Prefer natural boundaries (heading, paragraph, sentence) before splitting long sections.
- Retain chunk index, target size, overlap, section and page metadata when available.
- Ensure the chunker always advances and does not produce empty chunks.
- Do not claim exact token counts if only a character heuristic is used.

### 9.3 Retrieval and answer generation
- Apply allowed-document/owner filters in the database query.
- Retrieve a bounded top-k candidate set.
- Use one consistent distance metric.
- Calibrate relevance threshold using positive and negative examples; do not select a threshold solely by intuition.
- Instruct the model to use only supplied context and treat it as untrusted data.
- Use low temperature for factual answers.
- Return citations only if they refer to chunks actually retrieved for this request.
- Resolve citation document name, index, section and page from database records.
- If sources conflict, communicate the conflict and cite the relevant sources.
- If evidence is weak or absent, abstain.

### 9.4 Router and agent
- Direct RAG path is the default for document questions.
- Clear order intent routes to the order tool.
- Missing/ambiguous order identifiers should trigger clarification rather than guesswork.
- Tool names come from a fixed registry.
- Maximum steps: 4 by default; configurable.
- Per-call timeout and overall request deadline are configurable.
- Retry policy: at most two retries after the first attempt for transient failures, with exponential backoff and jitter.
- Token/cost budget should be enforced where provider usage/cost data is available; at minimum enforce output-token and step limits.
- Side-effecting operations are not parallelized with reads or retried blindly.

### 9.5 Ticket confirmation
- Prepare action first; do not write ticket in the preparation phase.
- Show subject, description summary and order reference if applicable.
- Confirmation must bind to a specific pending action, expire, and be single-use.
- Use idempotency to prevent duplicate tickets on retries or uncertain outcomes.
- If the result of a write is uncertain, reconcile against the idempotency key before retrying.
- The UI must clearly distinguish prepared from created.

### 9.6 Streaming
- Server-Sent Events (SSE) is the implemented protocol for one-way answer streaming.
- Events should distinguish status, answer token, final citations, completion and error.
- Citations should be shown as trusted only after server validation.
- Client must handle network interruption, cancellation and stream completion.
- Tool writes must not be accidentally repeated by retrying a stream request.

## 10. Non-functional requirements

### Reliability
- Database readiness is checked before the API is considered ready.
- External calls have explicit timeouts.
- Retries are bounded and limited to transient errors.
- Failures have consistent safe error codes and request IDs.
- Database constraints back up application-level idempotency.

### Security
- Provider keys remain server-side and are excluded from logs.
- File and user inputs are bounded and validated.
- Queries use parameterized SQL/ORM methods.
- Retrieved document text is never executed as instructions.
- Citation IDs and tool arguments are validated.
- Retrieval respects access scope.
- UI renders document text as escaped content, not arbitrary HTML.

### Performance
- Avoid invoking agent logic for simple RAG queries.
- Bound top-k, context tokens, generation tokens and tool steps.
- Measure per-stage and end-to-end latency.
- Do not promise a latency SLA; report measured results for the demo environment.

### Maintainability
- Separate HTTP routes from services and persistence.
- Use type hints, Pydantic schemas and small functions.
- Keep provider-specific details behind adapters.
- Use migrations and repeatable seed data.
- Keep README and contracts synchronized with code.

### Reproducibility
- Pin dependencies/lockfiles.
- Record model names, dimensions, tokenizer, chunk settings and retrieval configuration.
- Generate evaluation results with a script and retain per-question records.
- Keep test fixtures synthetic and deterministic.

## 11. User interface requirements

### Main page
- Product name and service/connection status.
- File upload dropzone/file picker.
- Supported type and size hint.
- Uploaded document list and ingestion status.
- Chat history and input composer.
- Streamed answer.
- Citation list with document name, chunk index, section/page and excerpt.
- Loading, empty, error, retry and unknown-answer states.
- Route/tool indicator for reviewer visibility.
- Ticket confirmation UI if ticket flow is exposed in chat.

### Accessibility
- Keyboard-accessible controls and visible focus.
- Labels for inputs and buttons.
- Errors announced accessibly.
- Status not communicated by color alone.
- Long citations readable on narrow screens.

## 12. Data requirements

Minimum entities:
- `documents`: identity, owner/scope, filename, content hash, MIME, byte size, status, timestamps.
- `document_chunks`: document FK, index, text, token count, section/page metadata, vector, embedding model, chunk settings.
- `orders`: order number, status, items, timestamps, scope/owner.
- `support_tickets`: subject, description, optional order reference, status, idempotency key, timestamps.
- `pending_actions`: action type/payload, confirmation token hash, expiry, consumption timestamp, scope/owner.

Use uniqueness constraints to prevent duplicate content and writes. Vector dimension must match the selected embedding model. If both chunk configurations are stored simultaneously, model/schema must account for chunk configuration without mixing vector dimensions.

## 13. Error behavior

| Condition | Expected behavior |
|---|---|
| Unsupported upload type | Clear 415-style error |
| File too large | Clear 413-style error |
| Empty/unparseable document | Clear 422-style error |
| Embedding provider unavailable | Safe service error; no partial ready document |
| No relevant chunks | “I don't know based on the available documents.” |
| Invalid citation from model | Reject/repair only from retrieved candidates; never display as trusted |
| Unknown order | Explicit not-found result |
| Order tool unavailable | Explain lookup could not be completed; do not invent status |
| Ticket not confirmed | No ticket write |
| Confirmation expired/replayed | Reject without duplicate write |
| Primary model failure | Use configured fallback for eligible failures; otherwise safe error |
| Both models fail | Safe service error with request ID |
| Database unavailable | Readiness failure and safe API error |

## 14. Evaluation and acceptance metrics

### Required comparison
Run 15 gold questions at 300-token and 800-token chunk sizes.

Report:
- Correct evidence/source chunk retrieved (count and recall@k).
- Answers supported by retrieved context (count).
- Average end-to-end response time.
- Preferably citation-valid rate, median latency, failure count and per-question results.

### Metric definitions
- **Correct retrieval:** at least one retrieved chunk contains evidence from the expected gold section needed to answer the question.
- **Supported answer:** material claims are entailed by retrieved context and citations refer only to retrieved chunks. Abstentions on answerable gold questions count as unanswered, not grounded successes.
- **Average latency:** request start to final response, including provider/network time.
- **Failures:** count separately; do not silently remove failed requests from reporting.

### Selection criteria
Choose chunk size using measured balance across retrieval recall, answer support, citation validity, latency/cost and context precision. Do not assume smaller or larger is inherently better.

### Additional evaluation
Compare vector-only and hybrid retrieval if implemented. Use a separate negative set to test unknown-question abstention. Do not mix negative questions into the 15 answerable gold questions without separately reporting them.

## 15. Acceptance criteria / definition of done

The assignment is considered complete when:
1. `docker compose up --build` starts the API, DB and frontend from a clean clone.
2. `.env.example` enumerates every required variable.
3. Sample document and order seed are available and repeatable.
4. PDF/TXT upload, validation, chunking, embedding and persistence work.
5. Duplicate upload does not duplicate chunks.
6. A known document question returns an answer with a valid citation.
7. An unknown question abstains.
8. An order question invokes the DB tool and returns seeded data accurately.
9. Ticket creation requires explicit confirmation.
10. A tool-failure test proves the system does not invent results.
11. Chunking and retrieval tests pass.
12. All 15 gold questions are evaluated at both chunk sizes.
13. README includes actual results and selection rationale.
14. README describes architecture, decisions, tradeoffs and future improvements.
15. No secrets, real customer data, fabricated metrics or undocumented setup steps are included.

## 16. Recommended implementation order

1. Repository scaffold, config, Docker Compose, database health and migrations.
2. Data models and deterministic seed fixtures.
3. Upload validation, parsing, hash-based deduplication and chunking.
4. Embedding adapter and pgvector persistence.
5. Vector retrieval, threshold, grounded prompt and citation validation.
6. Streaming UI and API.
7. Router, order lookup, ticket preparation/confirmation, guardrails and failure handling.
8. Hybrid retrieval and reranking comparison.
9. Evaluation script and gold-set runs.
10. Automated tests, security review, README and clean-machine verification.

## 17. Resolved implementation decisions and open items

- OpenAI-compatible provider adapter; `gpt-4.1-mini` primary model and optional configured fallback.
- `text-embedding-3-small`, 1536 dimensions, and `cl100k_base` tokenization.
- 800-token production chunks, 50-token overlap, top-k 5, cosine similarity and threshold 0.35.
- Hybrid pgvector + PostgreSQL full-text retrieval using RRF; no cross-encoder reranker.
- Fixed development owner scope with credential-bound tenant mappings available in production mode.
- SSE events are defined in the API contract; duplicate uploads return the existing document with `duplicate=true`.
- The stored benchmark contains one run per question/configuration; repeated trials remain future work.
- Output tokens, tool steps, timeouts and retries are bounded. Provider-reported monetary cost is not enforced.
- Open blocker: add a Compose-managed PostgreSQL/pgvector service and re-run the clean-machine reviewer workflow.
