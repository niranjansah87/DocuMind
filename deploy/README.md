# DocuMind — Production Deployment Guide

This folder contains the production provisioning and deployment automation for DocuMind on Linux (Ubuntu 22.04/24.04 or Debian 12).

## Architecture

```text
Browser Client
     │ (HTTPS only)
     ▼
Nginx Reverse Proxy (documind.niranjansah87.com.np:443)
     ├── /                    ──► Next.js Frontend (127.0.0.1:7777)
     ├── /_next/static/       ──► Next.js Static Cache
     ├── /api/*               ──► FastAPI Backend (127.0.0.1:8888) [Buffering OFF for SSE]
     └── /health, /ready      ──► FastAPI Health Endpoints
```

### Key Security & Network Features:
1. **Single Public Domain:** All browser requests use `https://documind.niranjansah87.com.np`.
2. **Hidden Backend:** The backend is bound to `127.0.0.1:8888` (internal only). There is no public backend domain or exposed port 8888. In browser developer tools / Network tab, all calls appear as relative or same-origin `https://documind.niranjansah87.com.np/api/v1/...`.
3. **SSE Streaming Support:** Nginx has `proxy_buffering off;` and `chunked_transfer_encoding on;` for `/api/`, allowing token-by-token streaming without buffering delays.
4. **Security Hardening:** HSTS, strict framing prevention (`SAMEORIGIN`), MIME sniffing protection (`nosniff`), and systemd sandboxing.

---

## Directory Structure

```text
deploy/
├── nginx/
│   ├── documind.conf         # Production Nginx reverse proxy with SSL & proxying
│   └── documind.http.conf    # Bootstrap config for initial Certbot ACME HTTP-01 challenge
├── systemd/
│   ├── documind-api.service  # Systemd service for FastAPI uvicorn daemon
│   └── documind-web.service  # Systemd service for Next.js web application
├── build.sh                  # Fast rebuild / update script for ongoing updates
├── deploy.sh                 # Full first-time provisioning & deployment script
└── README.md                 # This guide
```

---

## Prerequisites

On your production server (e.g. Ubuntu 22.04/24.04 LTS):

1. **System packages:**
   ```bash
   sudo apt update && sudo apt install -y curl git nginx certbot python3-certbot-nginx build-essential
   ```
2. **Node.js (v22+ or v24):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
3. **Python & `uv`:**
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   source $HOME/.cargo/env
   ```
4. **PostgreSQL 16 with pgvector:**
   ```bash
   sudo apt install -y postgresql-16 postgresql-16-pgvector
   ```
5. **DNS Record:**
   * Create an `A` record pointing `documind.niranjansah87.com.np` to your server's public IPv4 address.

---

## First-Time Deployment

1. **Clone the repository to `/var/www/documind`:**
   ```bash
   sudo mkdir -p /var/www/documind
   sudo chown -R $USER:$USER /var/www/documind
   git clone https://github.com/niranjansah87/DocuMind.git /var/www/documind
   cd /var/www/documind
   ```

2. **Configure production `.env`:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set:
   * `DATABASE_URL=postgresql+asyncpg://documind:YOUR_DB_PASSWORD@localhost:5432/documind`
   * `OPENAI_API_KEY=your_actual_openai_api_key`
   * `CORS_ORIGINS=https://documind.niranjansah87.com.np`
   * `NEXT_PUBLIC_API_BASE_URL=` (leave empty so browser uses relative `/api/v1/...`)

3. **Run the initial deploy script:**
   ```bash
   chmod +x deploy/*.sh
   sudo ./deploy/deploy.sh
   ```

The script will:
* Verify DNS for `documind.niranjansah87.com.np`
* Set up the `documind` service account
* Bootstrap Nginx and obtain a Let's Encrypt SSL certificate
* Install the production Nginx configuration with TLS 1.3 and security headers
* Run database migrations (`alembic upgrade head`) and seed data (`app.seed`)
* Build the Next.js application
* Install and launch `documind-api` and `documind-web` systemd services
* Test end-to-end HTTPS health checks

---

## Routine Updates (After Git Push)

For day-to-day updates when new commits are pushed:

```bash
cd /var/www/documind
./deploy/build.sh
```

To skip test gates during rapid debugging:
```bash
SKIP_TESTS=1 ./deploy/build.sh
```

---

## Service Management

Check service status:
```bash
sudo systemctl status documind-api
sudo systemctl status documind-web
sudo systemctl status nginx
```

View live logs:
```bash
# Backend API logs
sudo journalctl -u documind-api -f

# Frontend Web logs
sudo journalctl -u documind-web -f

# Nginx access & error logs
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

Restart services:
```bash
sudo systemctl restart documind-api documind-web
```

---

## SSL Renewal

Certbot automatically schedules certificate renewals via a systemd timer (`certbot.timer`). You can verify renewal at any time:
```bash
sudo certbot renew --dry-run
```
