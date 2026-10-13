# DocuMind — Document Q&A Assistant with RAG and an Agent

DocuMind is a take-home project for a document-grounded Q&A assistant. It is designed to demonstrate document ingestion, retrieval-augmented generation (RAG), citations, a database-backed order tool, and safe tool execution.

> **Implementation status:** This repository is a runnable starter scaffold. The Compose stack, health endpoints, configuration, and initial UI are provided. The RAG pipeline, model integrations, retrieval evaluation, and agent tools must be implemented and tested before submission. Do not report evaluation results until the evaluation runner has actually been run.

## Requirements

- Docker Desktop / Docker Engine with the Compose plugin
- Git
- An API key for the model provider selected during implementation
- Recommended: 8 GB RAM available to Docker

## Quick start

1. Clone the repository:

   ```bash
   git clone [<Documind>](https://github.com/niranjansah87/DocuMind.git)
   cd documind
   ```
2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

   On PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```
3. Edit `.env`. Set a strong local database password and add the model-provider API key when model integration is implemented. Never commit `.env`.
4. Start the stack:

   ```bash
   docker compose up --build
   ```
5. Open:

   - Frontend: http://localhost:3000
   - API docs: http://localhost:8000/docs
   - API health: http://localhost:8000/health
   - Readiness: http://localhost:8000/ready

Stop the stack with `Ctrl+C`, or run `docker compose down`. To remove the local database volume as well, run `docker compose down -v` (this permanently deletes local database data).

## Repository layout

```text
documind/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── api/routes/       # HTTP endpoints
│   │   │   ├── core/             # Settings and shared configuration
│   │   │   ├── db/               # Database connectivity and models
│   │   │   ├── ingestion/        # Parsing, chunking and embedding
│   │   │   ├── retrieval/        # Vector/hybrid retrieval and reranking
│   │   │   ├── agent/            # Router, tools and guardrails
│   │   │   ├── services/         # Application use cases/provider adapters
│   │   │   └── main.py
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── web/
│       ├── app/
│       ├── package.json
│       └── Dockerfile
├── data/
│   ├── sample_document.md
│   └── seed_data.json
├── evaluation/
│   ├── questions.json
│   └── results/                  # Actual experiment output goes here
├── .env.example
├── .gitignore
└── docker-compose.yml
```

## Architecture

- **Next.js frontend:** document upload and chat interface. The browser calls the API using `NEXT_PUBLIC_API_BASE_URL`.
- **FastAPI backend:** request validation, ingestion and chat orchestration. Route handlers should remain thin and delegate to services.
- **PostgreSQL + pgvector:** relational records and vector embeddings in one database. The database uses the `pgvector/pgvector:pg16` image.
- **Model provider:** selected provider is accessed only from the backend. Secrets belong in environment variables and must never be exposed with a `NEXT_PUBLIC_` prefix.
- **Evaluation harness:** a fixed set of 15 questions will be run against 300-token and 800-token chunk configurations.

## Planned API contract

The starter currently exposes health/readiness routes. Implement the following routes as the project grows:

| Method   | Route                     | Purpose                                                |
| -------- | ------------------------- | ------------------------------------------------------ |
| `GET`  | `/health`               | Liveness check                                         |
| `GET`  | `/ready`                | Verify database connectivity                           |
| `POST` | `/api/v1/documents`     | Upload PDF/TXT, deduplicate by content hash and ingest |
| `GET`  | `/api/v1/documents`     | List documents available to the current user           |
| `POST` | `/api/v1/chat`          | Ask a question and return an answer with citations     |
| `POST` | `/api/v1/chat/stream`   | Stream answer events using SSE                         |
| `POST` | `/api/v1/tools/tickets` | Prepare/confirm support ticket creation                |

The exact response schemas should be defined with Pydantic and documented in OpenAPI.

## RAG implementation plan

1. Validate PDF/TXT extension, MIME type and file size; return a clear `4xx` error for invalid input.
2. Extract text and retain page/section metadata.
3. Chunk by tokens with overlap. Evaluate 300 and 800 tokens using the same tokenizer, overlap policy, embedding model, top-k and test set.
4. Create embeddings and store them with chunk text, document ID, page/section and content hash.
5. Run vector search as a baseline; then compare hybrid keyword + vector retrieval and a reranker.
6. Filter retrieval by document and authorization scope.
7. Apply a measured relevance threshold. If the evidence is weak, return “I don't know based on the available documents.”
8. Generate answers only from retrieved context, use low temperature, validate citations against retrieved chunk IDs, and treat document text as untrusted data—not instructions.

### Embedding-model decision

Choose one embedding model before running the comparison and record its exact name, vector dimensions, language support, pricing assumptions and why it fits the task. The vector column dimensions must match the chosen model. Do not change embedding models between chunk-size experiments.

## Agent and tools

The required tools are:

- `search_docs`: retrieve document passages through the application's retrieval service.
- `get_order_status`: read an order from PostgreSQL; never infer a status.
- `create_ticket`: validate a proposed ticket, require explicit user confirmation, then write it to the database.

Guardrails to implement: Pydantic argument validation, maximum agent steps, per-request token/cost budget, tool timeout, bounded retry with backoff, primary-to-fallback model behavior, and honest failure messages. A tool failure must not be converted into a fabricated success.

Prefer deterministic routing for clearly identified order lookups and ordinary document questions. Use an agent only when tool selection/reasoning is actually needed.

## Environment variables

See `.env.example` for the complete starter list. Important rules:

- `.env` is local-only and must not be committed.
- Use a non-default database password outside local development.
- Keep model-provider API keys on the backend.
- `NEXT_PUBLIC_API_BASE_URL` is public browser configuration, not a secret.
- The Compose database hostname is `db`, not `localhost`, when accessed from the API container.

## Tests

Backend tests are run inside the API container once implemented:

```bash
docker compose run --rm api pytest -q
```

For local Python development:

```bash
cd apps/api
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell
# .venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -q
```

Required tests before submission:

- Chunking: empty input, overlap, token bounds and metadata preservation.
- Retrieval: relevant chunk is ranked in the expected top-k; irrelevant queries trigger refusal.
- Tool failure: database/tool timeout or provider failure returns a safe, actionable error and does not invent a result.
- Add tests for duplicate upload, invalid file, citation validity and ticket confirmation.

## Evaluation protocol

Use 15 questions with expected answers and gold sections/chunks. Run both chunk sizes under equivalent conditions. Report at least:

- **Correct-chunk retrieval rate:** questions where a gold/relevant chunk appears in top-k / 15.
- **Context-supported answer count:** generated answers supported by retrieved context / 15.
- **Average response time:** mean end-to-end duration for the same 15 questions.

Also record top-k, overlap, embedding model, retrieval mode, reranker, threshold, provider/model and whether the run included warm-up. Preserve raw per-question results under `evaluation/results/`.

**Do not fabricate metrics.** Populate the table below only after the experiments have run.

| Chunk size | Correct chunk retrieved | Context-supported answers |        Mean latency |
| ---------- | ----------------------: | ------------------------: | ------------------: |
| 300 tokens |     Pending measurement |       Pending measurement | Pending measurement |
| 800 tokens |     Pending measurement |       Pending measurement | Pending measurement |

### Final chunk-size choice

**Decision pending experimental results.** Choose the configuration that gives the best balance of retrieval quality, grounded-answer rate and latency on the fixed evaluation set. Explain trade-offs and include the actual measurements.

## Security and reliability checklist

- [ ] Upload size/type limits and safe parser errors
- [ ] No secrets in source control or frontend bundles
- [ ] User/document authorization filters on every retrieval
- [ ] Document text is treated as untrusted data
- [ ] Tool arguments are validated before execution
- [ ] Ticket writes require confirmation and are idempotent where practical
- [ ] Agent step/token/cost limits
- [ ] Tool timeouts and bounded retries
- [ ] Primary model fallback is tested
- [ ] Citation IDs must refer to retrieved chunks
- [ ] Unsupported questions return an explicit refusal
- [ ] Database readiness check and migrations are reliable

## Trade-offs and next improvements

Initial trade-offs:

- A modular monolith keeps local setup simple while separating routes, services, retrieval and tools.
- PostgreSQL + pgvector avoids operating a separate vector database for a small assignment.
- SSE is a good fit for one-way streamed chat responses; WebSockets are unnecessary unless bidirectional real-time interaction is required.
- A small, deterministic evaluation set is reproducible but cannot establish broad production retrieval quality.

Next improvements:

1. Complete ingestion, vector retrieval and model adapters with integration tests.
2. Add hybrid search and reranking, then compare against vector-only retrieval.
3. Add real authorization and tenant scoping, not just document metadata.
4. Add observability for latency, token usage, failures and retrieval scores.
5. Add rate limits, malware scanning and robust PDF parsing for production deployment.
6. Expand evaluation data and repeat experiments to estimate variance.

## Submission checklist

- [ ] Repository is public or reviewer `bikashsaud` has access.
- [ ] `.env.example` is complete and `.env` is not committed.
- [ ] `docker compose up --build` succeeds from a clean clone.
- [ ] Sample document uploads and produces cited answers.
- [ ] Order query demonstrably invokes the database tool.
- [ ] Out-of-scope query refuses to guess.
- [ ] Automated tests pass.
- [ ] Evaluation metrics are measured and documented.
- [ ] README reflects the implemented behavior, not only planned behavior.