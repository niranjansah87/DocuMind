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
* **Node.js 22+** and [`pnpm`](https://pnpm.io/)
* **PostgreSQL 16** with the `pgvector` extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`)

### Quick Start: Run Everything with One Command
From the repository root:
```bash
# Install all dependencies (frontend + dev runner)
pnpm install

# Run backend (port 8888) and frontend (port 7777) simultaneously
pnpm dev
```
Both services will start concurrently in a single terminal with colored prefixes (`[api]` in magenta, `[web]` in cyan). Pressing `Ctrl+C` cleanly stops both processes.

---

### Running Services Individually

#### 1. Backend API (`apps/api`)
```bash
cd apps/api

# Install dependencies into virtualenv
uv sync --frozen

# Apply database migrations
uv run alembic upgrade head

# Seed initial test data (sample orders)
uv run python -m app.seed

# Start development server on port 8888
uv run uvicorn app.main:app --host 127.0.0.1 --port 8888 --reload
```

#### 2. Frontend Web App (`apps/web`)
```bash
cd apps/web

# Install pnpm dependencies
pnpm install

# Start Next.js development server on port 7777
pnpm run dev
```

The web app is available at `http://localhost:7777` and automatically proxies `/api/*` requests to `http://127.0.0.1:8888` via Next.js internal rewrites.

---

## 3. Engineering Quality Gates

All contributions must pass automated tests, linting, and type checking before a pull request can be accepted.

### Running All Gates from Root
```bash
pnpm lint        # Runs ESLint (web) and Ruff (api)
pnpm typecheck   # Runs tsc (web) and mypy (api)
pnpm test        # Runs pytest (api) and frontend typecheck
```

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
pnpm run typecheck

# 2. ESLint
pnpm run lint

# 3. Production build
pnpm run build
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

