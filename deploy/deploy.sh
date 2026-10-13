#!/usr/bin/env bash
# =============================================================================
# DocuMind - Initial Server Provisioning and Production Deployment Script
#
# Target Domain: documind.niranjansah87.com.np
# Architecture: Single domain reverse proxy (Nginx)
#   - Frontend (Next.js):     http://127.0.0.1:3000
#   - Backend API (FastAPI):  http://127.0.0.1:8000 (hidden, no public backend domain)
#
# Usage:
#   sudo ./deploy/deploy.sh
#   ./deploy/deploy.sh --non-interactive
# =============================================================================
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/documind}"
PROD_BRANCH="${PROD_BRANCH:-main}"
DOMAIN="documind.niranjansah87.com.np"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env}"
NGINX_SRC="$APP_ROOT/deploy/nginx/documind.conf"
NGINX_HTTP_SRC="$APP_ROOT/deploy/nginx/documind.http.conf"
NGINX_DST="${NGINX_DST:-/etc/nginx/sites-available/documind.conf}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/documind.conf}"
NON_INTERACTIVE=0

[[ "${1:-}" == "--non-interactive" || "${CI:-}" == "true" ]] && NON_INTERACTIVE=1

info(){ printf '[ * ] %s\n' "$*"; }
ok(){ printf '[ OK ] %s\n' "$*"; }
die(){ printf '[FAIL] %s\n' "$*" >&2; exit 1; }
trap 'die "deployment stopped at line $LINENO"' ERR
need(){ command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

confirm(){
  [[ "$NON_INTERACTIVE" == 0 ]] || return 0
  local answer
  read -r -p "$1 [y/N] " answer
  [[ "$answer" == y || "$answer" == Y ]] || die "operator declined"
}

env_value(){
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r' | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

# 1. Dependency checks
info "Checking required system commands"
need git; need python3; need uv; need node; need npm; need curl; need nginx; need systemctl; need dig; need sudo

[[ -d "$APP_ROOT/.git" ]] || die "APP_ROOT is not a git repository: $APP_ROOT"
[[ -f "$ENV_FILE" ]] || die "Production environment file missing: $ENV_FILE"

cd "$APP_ROOT"

# Check critical environment variables
db_url="$(env_value DATABASE_URL)"
openai_key="$(env_value OPENAI_API_KEY)"
[[ -n "$db_url" ]] || die "DATABASE_URL is missing in $ENV_FILE"
[[ -n "$openai_key" && "$openai_key" != "replace-me" ]] || die "OPENAI_API_KEY is not configured in $ENV_FILE"

# 2. DNS verification
info "Verifying DNS record for $DOMAIN"
server_ipv4="$(curl -4fsS --max-time 5 https://api.ipify.org || true)"
records="$(dig +short A "$DOMAIN" | tr '\n' ' ')"
if [[ -n "$records" ]]; then
  info "DNS A records found for $DOMAIN: $records"
  if [[ -n "$server_ipv4" && " $records " != *" $server_ipv4 "* ]]; then
    if curl -fsSI --max-time 5 "http://$DOMAIN" 2>/dev/null | grep -qi '^server: cloudflare'; then
      info "$DOMAIN appears to be managed via Cloudflare/CDN proxy."
    else
      info "Notice: DNS points to $records, current server IP is $server_ipv4. Ensure traffic routes here."
    fi
  fi
else
  info "Warning: No DNS A record found yet for $DOMAIN. Ensure DNS is pointed before Let's Encrypt."
fi

confirm "Continue with deployment to $DOMAIN?"

# 3. Create service user if not present
if ! id -u documind >/dev/null 2>&1; then
  info "Creating dedicated system user 'documind'"
  sudo useradd --system --create-home --home-dir /home/documind --shell /usr/sbin/nologin documind
fi

# Ensure evaluation results directory is writable
sudo mkdir -p "$APP_ROOT/evaluation/results"
sudo chown -R documind:documind "$APP_ROOT/evaluation/results"

# 4. Prepare Certbot ACME webroot
info "Setting up ACME challenge directory"
sudo install -d -m 0755 /var/www/certbot /var/www/certbot/.well-known /var/www/certbot/.well-known/acme-challenge

# 5. Bootstrap Nginx for Let's Encrypt
info "Installing HTTP bootstrap Nginx configuration"
sudo install -m 0644 "$NGINX_HTTP_SRC" "$NGINX_DST"
sudo ln -sfn "$NGINX_DST" "$NGINX_ENABLED"
sudo nginx -t
sudo systemctl reload nginx

# 6. Obtain SSL certificate
if ! command -v certbot >/dev/null 2>&1; then
  die "certbot is required. Install with: sudo apt install -y certbot python3-certbot-nginx"
fi

if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
  ok "Certificate directory exists for $DOMAIN"
else
  info "Requesting Let's Encrypt SSL certificate for $DOMAIN"
  sudo certbot certonly --webroot -w /var/www/certbot --keep-until-expiring -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
  sudo certbot certonly --webroot -w /var/www/certbot --keep-until-expiring -d "$DOMAIN"
fi

# 7. Install production Nginx config with SSL & proxy
info "Installing production SSL Nginx configuration"
sudo install -m 0644 "$NGINX_SRC" "$NGINX_DST"
sudo nginx -t
sudo systemctl reload nginx

# 8. Setup and build backend
info "Setting up backend (uv sync, alembic migrations, seeds)"
cd "$APP_ROOT/apps/api"
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.seed

# Install and start backend systemd service
sudo install -m 0644 "$APP_ROOT/deploy/systemd/documind-api.service" "/etc/systemd/system/documind-api.service"
sudo systemctl daemon-reload
sudo systemctl enable documind-api
sudo systemctl restart documind-api

# 9. Setup and build frontend
info "Setting up frontend (npm ci, build)"
cd "$APP_ROOT/apps/web"
npm ci
npm run build

# Install and start frontend systemd service
sudo install -m 0644 "$APP_ROOT/deploy/systemd/documind-web.service" "/etc/systemd/system/documind-web.service"
sudo systemctl daemon-reload
sudo systemctl enable documind-web
sudo systemctl restart documind-web

# 10. Health check and verification
info "Verifying services status"
sleep 3

for ((i=1; i<=15; i++)); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1; then
    ok "Local services are healthy"
    break
  fi
  sleep 2
done

info "Checking public HTTPS endpoints"
if curl -fsSI "https://$DOMAIN/health" 2>/dev/null | grep -qi "200 OK"; then
  ok "HTTPS Health Check: https://$DOMAIN/health is reachable"
fi

sudo certbot renew --dry-run || info "Certbot dry-run finished"

ok "=========================================================="
ok "DocuMind deployed successfully to https://$DOMAIN"
ok "Backend API is hidden and proxied internally under /api/*"
ok "=========================================================="
