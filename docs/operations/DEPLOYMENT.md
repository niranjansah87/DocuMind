# Deployment and Operations Guide - DocuMind

This document details operations, local setup (with and without Docker), and production deployment for **DocuMind**.

---

## 1. Operating Modes

DocuMind supports three operating environments:

1. **Local Development (Native / Without Docker):** Direct execution using Python virtual environments (`uv`) and Node.js (`npm`).
2. **Containerized application services (Docker Compose):** API and web containers connected to an externally managed PostgreSQL/pgvector database.
3. **Production Deployment (Nginx + Systemd):** Single-domain reverse proxy (`documind.niranjansah87.com.np`) with SSL and hidden internal backend.

---

## 2. Local Setup Without Docker

This is the recommended workflow for developing on Windows, macOS, or Linux without container overhead.

### 2.1 Prerequisites
* **Python 3.12+** with [`uv`](https://docs.astral.sh/uv/) installed.
* **Node.js 22+** and [`pnpm`](https://pnpm.io/).
* **PostgreSQL 16** with `pgvector` extension installed and running locally on port 5432.
* An OpenAI API key with access to chat and embedding models.

### 2.2 Database Initialization
Ensure PostgreSQL is running and initialize the database:
```sql
CREATE DATABASE documind;
\c documind;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.3 Environment Setup
Copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` and `OPENAI_API_KEY` are configured properly.

### 2.4 Quick Start: Run Everything with One Command
From repository root:
```bash
pnpm install
pnpm dev
```
Runs both FastAPI backend (port 8888) and Next.js frontend (port 7777) simultaneously in one terminal with colored prefix tags.

### 2.5 Running Services Individually

#### Backend API
```bash
cd apps/api
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --host 127.0.0.1 --port 8888 --reload
```
API endpoints will be live at:
* Dashboard & Landing Page: `http://127.0.0.1:8888/`
* Liveness: `http://127.0.0.1:8888/health`
* Readiness: `http://127.0.0.1:8888/ready`
* OpenAPI Docs: `http://127.0.0.1:8888/docs`

#### Frontend Web Application
In a separate terminal:
```bash
cd apps/web
pnpm install
pnpm run dev
```
The application will be accessible at `http://localhost:7777`.
Internal rewrites in Next.js automatically forward `/api/*`, `/health`, and `/ready` to `http://127.0.0.1:8888`.

---

## 3. Containerized Deployment (Docker Compose)

Prerequisites: Docker Engine/Desktop with Compose plugin.

The checked-in Compose file does **not** define a PostgreSQL service. This is a known gap against the assignment's required one-command clean-machine workflow.

1. Copy `.env.example` to `.env.production`.
2. Set `OPENAI_API_KEY` and set `DATABASE_URL` to a PostgreSQL instance reachable from the API container. The database must have pgvector available.
3. Build and launch the application services:
   ```bash
   docker compose up --build
   ```
4. Stop services:
   ```bash
   docker compose down
   ```

---

## 4. Production Deployment (Nginx Reverse Proxy)

### 4.1 Architecture
* **Domain:** `documind.niranjansah87.com.np`
* **Nginx Reverse Proxy:** Routes all public HTTPS traffic.
* **Next.js Frontend:** Runs on `127.0.0.1:7777` via `documind-web.service`.
* **FastAPI Backend:** Runs on `127.0.0.1:8888` via `documind-api.service`.
* **Hidden Backend:** No public backend domain or open port 8888 exists. All API requests are proxied internally via `https://documind.niranjansah87.com.np/api/v1/...`.

### 4.2 Initial Setup
Execute the provisioning script:
```bash
cd /var/www/documind
chmod +x deploy/*.sh
sudo ./deploy/deploy.sh
```

### 4.3 Routine Rebuilds
For ongoing updates after code pushes:
```bash
./deploy/build.sh
```

---

## 5. Operations & Health Checks

| Check | Target | Expected Status |
| :--- | :--- | :--- |
| Process Liveness | `GET /health` | `{"status":"ok"}` (HTTP 200) |
| Database & pgvector Readiness | `GET /ready` | `{"status":"ready","database":"connected","vector_extension":"available"}` (HTTP 200) |
| Ingestion Status | `GET /api/v1/documents` | List of indexed documents in scope |
| Systemd API Daemon | `systemctl status documind-api` | `active (running)` |
| Systemd Web Daemon | `systemctl status documind-web` | `active (running)` |

---

## 6. Troubleshooting

* **Backend port conflict:** If port 8888 is occupied, adjust `API_PORT` in `.env` and `documind.conf`.
* **pgvector extension error:** Run `CREATE EXTENSION IF NOT EXISTS vector;` manually in PostgreSQL using superuser privileges.
* **SSE streaming delays:** Confirm `proxy_buffering off;` and `chunked_transfer_encoding on;` are present in Nginx for `location /api/`.
* **CORS error:** Ensure `CORS_ORIGINS` in `.env` includes `https://documind.niranjansah87.com.np`.
