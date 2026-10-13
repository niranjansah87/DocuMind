from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.core.config import get_settings

router = APIRouter(tags=["landing"])


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
async def landing_page() -> HTMLResponse:
    settings = get_settings()

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DocuMind API — Document Intelligence & Agentic RAG</title>
  <style>
    :root {{
      --bg: #090d16;
      --card-bg: #0f172a;
      --card-hover: #1e293b;
      --border: #1e293b;
      --border-accent: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-dark: #0284c7;
      --accent: #818cf8;
      --success: #22c55e;
      --success-glow: rgba(34, 197, 94, 0.25);
    }}
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1.25rem;
    }}
    .container {{
      max-width: 1080px;
      width: 100%;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--primary);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.825rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }}
    .pulse-dot {{
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--success-glow);
      display: inline-block;
      animation: pulse 2s infinite;
    }}
    @keyframes pulse {{
      0% {{ transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }}
      70% {{ transform: scale(1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }}
      100% {{ transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }}
    }}
    h1 {{
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.75rem;
    }}
    p.lead {{
      font-size: 1.15rem;
      color: var(--text-muted);
      max-width: 680px;
      margin-bottom: 2.25rem;
    }}
    .grid-2 {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }}
    .stat-card {{
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      transition: border-color 0.2s;
    }}
    .stat-card:hover {{
      border-color: var(--border-accent);
    }}
    .stat-label {{
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
    }}
    .stat-value {{
      font-size: 1.25rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-top: 0.25rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }}
    h2 {{
      font-size: 1.35rem;
      font-weight: 700;
      margin-top: 1.5rem;
      margin-bottom: 1rem;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }}
    .endpoints-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }}
    .card {{
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }}
    .card:hover {{
      background: var(--card-hover);
      border-color: var(--primary);
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }}
    .card-top {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }}
    .card-title {{
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff;
    }}
    .card-badge {{
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }}
    .badge-get {{ background: rgba(34, 197, 94, 0.15); color: #4ade80; }}
    .badge-doc {{ background: rgba(56, 189, 248, 0.15); color: #38bdf8; }}
    .badge-ui {{ background: rgba(129, 140, 248, 0.15); color: #a5b4fc; }}
    .card-desc {{
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
      flex-grow: 1;
    }}
    .card-url {{
      font-size: 0.8rem;
      color: var(--primary);
      font-family: ui-monospace, SFMono-Regular, monospace;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }}
    .guardrails-box {{
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(9, 13, 22, 0.8) 100%);
      border: 1px solid var(--border-accent);
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 2.5rem;
    }}
    .guardrails-list {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }}
    .guardrail-item {{
      font-size: 0.875rem;
      color: var(--text-muted);
    }}
    .guardrail-item strong {{
      color: #f1f5f9;
      display: block;
      margin-bottom: 0.2rem;
    }}
    footer {{
      margin-top: auto;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      width: 100%;
    }}
    footer a {{
      color: var(--primary);
      text-decoration: none;
    }}
    footer a:hover {{
      text-decoration: underline;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">
      <span class="pulse-dot"></span>
      DocuMind API Service • Operational
    </div>
    <h1>DocuMind Intelligence API</h1>
    <p class="lead">
      Document Q&A assistant featuring Retrieval-Augmented Generation (RAG), vector similarity with pgvector, and bounded agent tool execution.
    </p>

    <!-- Runtime Specifications -->
    <div class="grid-2">
      <div class="stat-card">
        <div class="stat-label">Environment</div>
        <div class="stat-value">{settings.app_env.upper()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Port & Host</div>
        <div class="stat-value">127.0.0.1:{settings.api_port}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">LLM Model</div>
        <div class="stat-value">{settings.llm_model}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Embedding Dimensions</div>
        <div class="stat-value">{settings.embedding_dimensions}d</div>
      </div>
    </div>

    <!-- API Portals & Interactive Endpoints -->
    <h2>API Endpoints & Documentation</h2>
    <div class="endpoints-grid">
      <a href="/docs" class="card">
        <div class="card-top">
          <span class="card-title">OpenAPI Interactive Docs</span>
          <span class="card-badge badge-doc">SWAGGER</span>
        </div>
        <div class="card-desc">Interactive Swagger UI to test and inspect all API endpoints, schemas, and request models directly.</div>
        <div class="card-url">GET /docs &rarr;</div>
      </a>

      <a href="/redoc" class="card">
        <div class="card-top">
          <span class="card-title">ReDoc Documentation</span>
          <span class="card-badge badge-doc">REDOC</span>
        </div>
        <div class="card-desc">Clean, responsive OpenAPI specification and reference documentation for developer integration.</div>
        <div class="card-url">GET /redoc &rarr;</div>
      </a>

      <a href="/health" class="card">
        <div class="card-top">
          <span class="card-title">Process Liveness</span>
          <span class="card-badge badge-get">JSON</span>
        </div>
        <div class="card-desc">Lightweight process liveness probe returning instant service status for load balancers and systemd.</div>
        <div class="card-url">GET /health &rarr;</div>
      </a>

      <a href="/ready" class="card">
        <div class="card-top">
          <span class="card-title">System Readiness</span>
          <span class="card-badge badge-get">JSON</span>
        </div>
        <div class="card-desc">Deep readiness probe verifying active PostgreSQL connection pool and pgvector extension availability.</div>
        <div class="card-url">GET /ready &rarr;</div>
      </a>

      <a href="/api/v1/meta" class="card">
        <div class="card-top">
          <span class="card-title">Application Metadata</span>
          <span class="card-badge badge-get">JSON</span>
        </div>
        <div class="card-desc">Current runtime configuration, supported file limits, active models, and available bounded tools.</div>
        <div class="card-url">GET /api/v1/meta &rarr;</div>
      </a>

      <a href="/api/v1/evaluation" class="card">
        <div class="card-top">
          <span class="card-title">Evaluation Benchmark</span>
          <span class="card-badge badge-get">JSON</span>
        </div>
        <div class="card-desc">Empirical benchmark results comparing 300-token and 800-token chunk configurations across gold set questions.</div>
        <div class="card-url">GET /api/v1/evaluation &rarr;</div>
      </a>
    </div>

    <!-- Architecture & Guardrails Overview -->
    <div class="guardrails-box">
      <h2>Architectural Guardrails</h2>
      <div class="guardrails-list">
        <div class="guardrail-item">
          <strong>Untrusted Document Scope</strong>
          Document text is quarantined in <code>&lt;untrusted_context&gt;</code> tags. Instructions inside docs are ignored.
        </div>
        <div class="guardrail-item">
          <strong>Verifiable Citations</strong>
          Citation IDs returned to users are verified against stored candidate chunks to eliminate citation hallucination.
        </div>
        <div class="guardrail-item">
          <strong>Confirmed Action Writes</strong>
          Ticket creation requires an expiring (10m TTL), single-use confirmation token with idempotency keys.
        </div>
        <div class="guardrail-item">
          <strong>Hidden Backend Topology</strong>
          Internal reverse proxy hides port {settings.api_port}. Client requests use same-origin relative endpoints.
        </div>
      </div>
    </div>

    <footer>
      DocuMind API &bull; Running on Python / FastAPI / pgvector &bull;
      Frontend Web: <a href="http://localhost:7777" target="_blank" rel="noreferrer">http://localhost:7777</a>
    </footer>
  </div>
</body>
</html>
"""
    return HTMLResponse(content=html_content)
