#!/usr/bin/env bash
# =============================================================================
# DocuMind - Routine Update / Rebuild Script
#
# Use this script for ongoing updates once deploy/deploy.sh has done the initial
# provisioning (Nginx, SSL/Certbot, systemd services).
#
# Usage:
#   ./deploy/build.sh                 # Standard update: pull, test, migrate, build, restart
#   SKIP_TESTS=1 ./deploy/build.sh    # Fast rebuild skipping test suites
#   NO_PULL=1 ./deploy/build.sh       # Build the current local tree as-is without git pull
# =============================================================================
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/documind}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env}"
SERVICES="${SERVICES:-documind-api documind-web}"
SKIP_TESTS="${SKIP_TESTS:-0}"
NO_PULL="${NO_PULL:-0}"

if [[ -t 1 ]]; then
  C_G=$'\e[32m'; C_R=$'\e[31m'; C_B=$'\e[34m'; C_0=$'\e[0m'
else
  C_G=""; C_R=""; C_B=""; C_0=""
fi

info(){ printf '%s[ * ]%s %s\n' "$C_B" "$C_0" "$*"; }
ok(){ printf '%s[ OK ]%s %s\n' "$C_G" "$C_0" "$*"; }
die(){ printf '%s[FAIL]%s %s\n' "$C_R" "$C_0" "$*" >&2; exit 1; }
trap 'die "update failed at line $LINENO (command: $BASH_COMMAND)"' ERR
need(){ command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }

need git; need python3; need uv; need node; need npm; need sudo; need systemctl; need curl

[[ -d "$APP_ROOT/.git" ]] || die "APP_ROOT is not a git checkout: $APP_ROOT"
[[ -f "$ENV_FILE" ]] || die "Environment file missing: $ENV_FILE"

cd "$APP_ROOT"

# 1. Git pull
if [[ "$NO_PULL" != "1" ]]; then
  info "Pulling latest code (git pull --ff-only)"
  git pull --ff-only
fi

# 2. Backend update & gates
info "Synchronizing backend dependencies (uv sync)"
cd "$APP_ROOT/apps/api"
uv sync --frozen

if [[ "$SKIP_TESTS" != "1" ]]; then
  info "Running backend lint (ruff)"
  uv run ruff check . --no-cache

  info "Running backend typecheck (mypy)"
  uv run mypy app

  info "Running backend test suite (pytest)"
  uv run pytest -q -p no:cacheprovider
else
  info "Backend tests skipped (SKIP_TESTS=1)"
fi

info "Applying database migrations (alembic upgrade head)"
uv run alembic upgrade head

info "Applying idempotent seed data (app.seed)"
uv run python -m app.seed

# 3. Frontend update & build
info "Synchronizing frontend dependencies (npm ci)"
cd "$APP_ROOT/apps/web"
npm ci

if [[ "$SKIP_TESTS" != "1" ]]; then
  info "Running frontend lint (eslint)"
  npm run lint

  info "Running frontend typecheck (tsc)"
  npm run typecheck
else
  info "Frontend tests skipped (SKIP_TESTS=1)"
fi

info "Building Next.js frontend (npm run build)"
build_start=$(date +%s)
npm run build
ok "Frontend build finished in $(( $(date +%s) - build_start ))s"

# 4. Restart systemd services
cd "$APP_ROOT"
info "Restarting services: $SERVICES"
if [[ -n "${SUDO_PASSWORD:-}" ]]; then
  printf '%s\n' "$SUDO_PASSWORD" | sudo -S systemctl restart $SERVICES
else
  sudo systemctl restart $SERVICES
fi

# 5. Local health verification
info "Verifying service health"
sleep 2
curl -fsS http://127.0.0.1:8000/health >/dev/null || die "API /health failed"
curl -fsS http://127.0.0.1:8000/ready >/dev/null || die "API /ready failed"
curl -fsS http://127.0.0.1:3000/ >/dev/null || die "Web frontend http://127.0.0.1:3000 failed"

ok "Update complete! DocuMind services restarted successfully ($SERVICES)"
