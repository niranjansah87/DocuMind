# Contributing to DocuMind

Thank you for your interest in contributing to **DocuMind**! This document provides guidelines for setting up your development environment, following code style standards, and submitting pull requests.

---

## 1. Code of Conduct

* Treat everyone with respect and empathy.
* Focus on constructive code reviews and clear technical justifications.
* Prioritize verifiable citations, secure boundaries, and clean-start usability.

---

## 2. Local Development Setup (Without Docker)

You can run DocuMind locally on Windows, macOS, or Linux using native tools:

### Prerequisites
* **Python 3.12+** and [`uv`](https://docs.astral.sh/uv/)
* **Node.js 22+** and `npm`
* **PostgreSQL 16** with the `pgvector` extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`)

### 1. Backend API (`apps/api`)
```bash
# Navigate to API directory
cd apps/api

# Install dependencies into virtualenv
uv sync --frozen

# Apply database migrations
uv run alembic upgrade head

# Seed initial test data (sample orders)
uv run python -m app.seed

# Start development server with hot-reload
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Web App (`apps/web`)
```bash
# Navigate to Web directory
cd apps/web

# Install npm dependencies
npm ci

# Start Next.js development server
npm run dev
```

The web app is available at `http://localhost:3000` and automatically proxies `/api/*` requests to `http://127.0.0.1:8000` via Next.js internal rewrites.

---

## 3. Engineering Quality Gates

All contributions must pass automated tests, linting, and type checking before a pull request can be accepted.

### Backend Gates
Run from `apps/api`:
```bash
# 1. Run unit & contract test suite
uv run pytest -q -p no:cacheprovider

# 2. Run Ruff linter & formatter check
uv run ruff check . --no-cache

# 3. Run strict static type checking
uv run mypy app
```

### Frontend Gates
Run from `apps/web`:
```bash
# 1. Static typecheck
npm run typecheck

# 2. ESLint
npm run lint

# 3. Production build
npm run build
```

---

## 4. Architectural Rules & Invariants

When writing code for DocuMind, you must adhere to the repository invariants:

1. **Document Validation:** Only `.pdf` and `.txt` are permitted. Validate file signatures and byte limits server-side.
2. **Grounding & Citations:** The model must never fabricate citations or source passages. Citation IDs must resolve to retrieved database chunks.
3. **Controlled Agent Tools:** The LLM cannot execute arbitrary SQL or shell commands. Tool execution is limited to `search_docs`, `get_order_status`, and `create_ticket`.
4. **Side Effect Guardrails:** State-mutating actions (like ticket creation) require explicit, expiring, single-use confirmation tokens.
5. **No Secret Leakage:** Never commit `.env` files or log API keys, database connection strings, or full auth headers.

---

## 5. Pull Request Process

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your focused changes and write corresponding tests.
3. Verify all backend and frontend quality gates pass locally.
4. Push your branch and open a Pull Request describing your changes, motivation, and test coverage.
