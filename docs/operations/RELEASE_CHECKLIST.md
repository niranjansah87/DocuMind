# Production Release Checklist & Deployment Runbook

## 1. Pre-Flight Verification (Stage Gate)

Before promoting any release to staging or production, verify all automated checks pass:

- [ ] **Git Working Tree:** Clean, no untracked experimental files, on authorized release branch.
- [ ] **Backend Quality Suite:**
  - `uv run --directory apps/api ruff check app tests` (0 lint errors)
  - `uv run --directory apps/api mypy app tests` (0 type errors across all source files)
  - `uv run --directory apps/api pytest` (100% tests passing)
- [ ] **Frontend Quality Suite:**
  - `npm run typecheck --prefix apps/web` (0 TypeScript errors)
  - `npm run lint --prefix apps/web` (0 ESLint errors/warnings)
  - `npm run build --prefix apps/web` (Successful Turbopack production build)
- [ ] **Security Checks:**
  - No secrets or credentials committed in Git.
  - Dependencies audited with zero known high/critical vulnerabilities.
  - Rate limiting active and configured appropriately for traffic tier.
- [ ] **Database Migrations:**
  - Alembic migration scripts tested with `uv run alembic upgrade head` on test instance.
  - Migrations are backwards-compatible and non-blocking.
- [ ] **RAG Quality Baseline:**
  - 15 Gold Questions benchmark verified with 100% retrieval recall and 100% context support.

---

## 2. Deployment Execution Sequence

1. **Snapshot Database:**
   Execute a pre-deployment backup using `pg_dump -Fc` per [`BACKUP_AND_RESTORE.md`](BACKUP_AND_RESTORE.md).
2. **Apply Migrations:**
   ```bash
   uv run alembic upgrade head
   ```
3. **Deploy Backend Service:**
   Deploy updated FastAPI container image, verify readiness probe `/ready` returns HTTP 200.
4. **Deploy Frontend Service:**
   Deploy updated Next.js container image.
5. **Post-Deployment Smoke Tests:**
   - Execute liveness check: `GET /health` -> 200 OK.
   - Execute readiness check: `GET /ready` -> 200 OK.
   - Execute sample document upload & verify ingestion status.
   - Execute grounded Q&A test query & verify inline citation generation.
   - Execute order lookup query & verify agent tool routing.
   - Execute unsupported question query & verify anti-hallucination abstention.

---

## 3. Rollback Procedure

If post-deployment smoke tests fail or elevated 5xx error rates occur:
1. **Revert Frontend & Backend Containers:** Roll back to the previous stable container image tag.
2. **Revert Database (if required):**
   ```bash
   uv run alembic downgrade -1
   ```
   Or restore from the pre-deployment snapshot if schema corruption occurred.
3. **Verify Health:** Confirm `/ready` probe returns HTTP 200.
4. **Post-Mortem:** Conduct root cause analysis within 24 hours.
