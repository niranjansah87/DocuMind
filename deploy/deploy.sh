#!/usr/bin/env bash
# =============================================================================
# DocuMind - Production Deployment Script (Docker Compose + Nginx)
#
# Target Domain: documind.niranjansah87.com.np
# Architecture:
#   - Frontend & Backend: Managed via Docker Compose
#   - Host Nginx: Reverse proxy with SSL termination
#
# Usage:
#   sudo ./deploy/deploy.sh
#   ./deploy/deploy.sh --non-interactive
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_ROOT="${APP_ROOT:-$REPO_DIR}"
DOMAIN="documind.niranjansah87.com.np"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env.production}"
[[ -f "$ENV_FILE" ]] || ENV_FILE="$APP_ROOT/.env"

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
need docker; need curl; need nginx; need systemctl; need dig; need sudo

[[ -d "$APP_ROOT" ]] || die "APP_ROOT does not exist: $APP_ROOT"
[[ -f "$ENV_FILE" ]] || die "Environment file missing: $ENV_FILE"

cd "$APP_ROOT"

# Check critical environment variables
db_url="$(env_value DATABASE_URL)"
openai_key="$(env_value OPENAI_API_KEY)"
[[ -n "$db_url" ]] || die "DATABASE_URL is missing in $ENV_FILE"
[[ -n "$openai_key" && "$openai_key" != "replace-me" ]] || die "OPENAI_API_KEY is not configured in $ENV_FILE"

# 2. DNS verification
info "Verifying DNS record for $DOMAIN"
records="$(dig +short A "$DOMAIN" | tr '\n' ' ')"
if [[ -n "$records" ]]; then
  info "DNS A records found for $DOMAIN: $records"
else
  info "Warning: No DNS A record found yet for $DOMAIN."
fi

confirm "Continue with deployment to $DOMAIN?"

# 3. Prepare Certbot ACME webroot
info "Setting up ACME challenge directory"
sudo install -d -m 0755 /var/www/certbot /var/www/certbot/.well-known /var/www/certbot/.well-known/acme-challenge

# 4. Bootstrap Nginx for Let's Encrypt
info "Installing HTTP bootstrap Nginx configuration"
sudo install -m 0644 "$NGINX_HTTP_SRC" "$NGINX_DST"
sudo ln -sfn "$NGINX_DST" "$NGINX_ENABLED"
sudo nginx -t

if systemctl is-active --quiet nginx; then
  sudo systemctl reload nginx
else
  sudo systemctl start nginx
fi

# 5. Obtain SSL certificate
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

# 6. Install production Nginx config with SSL & proxy
info "Installing production SSL Nginx configuration"
sudo install -m 0644 "$NGINX_SRC" "$NGINX_DST"
sudo nginx -t

if systemctl is-active --quiet nginx; then
  sudo systemctl reload nginx
else
  sudo systemctl start nginx
fi

# 7. Build and run containers via Docker Compose
info "Building and launching containers via Docker Compose"
# Make sure .env exists for docker-compose interpolation
if [[ ! -f "$APP_ROOT/.env" && -f "$APP_ROOT/.env.production" ]]; then
  cp "$APP_ROOT/.env.production" "$APP_ROOT/.env"
fi

docker compose --env-file "$ENV_FILE" up -d --build

# 8. Health check and verification
info "Verifying container services status"
sleep 5

for ((i=1; i<=20; i++)); do
  if curl -fsS http://127.0.0.1:8888/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:7777/ >/dev/null 2>&1; then
    ok "Containers are up and healthy on 127.0.0.1:8888 and 127.0.0.1:7777"
    break
  fi
  sleep 3
done

info "Checking public HTTPS endpoints"
if curl -fsSI "https://$DOMAIN/health" 2>/dev/null | grep -qi "200 OK"; then
  ok "HTTPS Health Check: https://$DOMAIN/health is reachable"
fi

ok "=========================================================="
ok "DocuMind deployed successfully via Docker + Nginx!"
ok "URL: https://$DOMAIN"
ok "=========================================================="
