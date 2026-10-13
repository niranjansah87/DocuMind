# Risks, Open Decisions and Mitigations

## 1. Risk register

  -------------------------------------------------------------------------------------
  ID             Risk              Likelihood /   Mitigation        Trigger
                                   impact                           
  -------------- ----------------- -------------- ----------------- -------------------
  R1             External          Medium / High  Early smoke test; Provider call fails
                 LLM/embedding                    clear errors;     
                 quota or key                     mock tests;       
                 issue                            fallback for      
                                                  generation        

  R2             Deadline overrun  High / High    Vertical slices;  Core upload/chat
                 from optional                    prioritize        not working by
                 complexity                       reviewer path;    midpoint
                                                  defer             
                                                  nonessential      
                                                  infra             

  R3             Unreliable        Medium / High  Same gold         Metrics conflict or
                 chunk-size                       set/settings,     vary widely
                 conclusion                       repeated runs,    
                                                  per-question logs 

  R4             False citations   Medium / High  Server-side       Citation ID absent
                                                  citation          from retrieved set
                                                  resolution and    
                                                  validation        

  R5             Hallucinated      Medium / High  Tool result       Tool
                 order status on                  schema; no answer exception/timeout
                 tool failure                     from failed tool  

  R6             Ticket written    Low / High     Separate          Write path invoked
                 without                          prepare/confirm   directly
                 confirmation                     endpoints,        
                                                  expiry,           
                                                  idempotency       

  R7             Cross-document    Medium / High  SQL-level filters Unauthorized
                 retrieval leak                   and isolation     document ID
                                                  tests             supplied

  R8             PDF extraction    Medium /       Clear error;      Scanned PDF
                 returns empty     Medium         disclose OCR not  uploaded
                 text                             supported         

  R9             Docker cold start Medium / High  Health checks, DB API starts before
                 failure                          readiness,        DB ready
                                                  clean-clone test  

  R10            Model provider    Medium /       Calibrate         Many relevant
                 changes score     Medium         threshold per     queries abstain
                 semantics                        metric/model      

  R11            Hybrid/reranker   Medium /       Measure against   Higher latency/no
                 adds latency      Medium         baseline;         recall gain
                 without quality                  configurable      
                 gain                             switch            

  R12            Duplicate upload  Low / High     Database          Concurrent
                 race                             uniqueness and    same-file upload
                                                  transaction       

  R13            Demo auth scope   Medium / High  Document demo     No real identity
                 misrepresented as                boundary; scope   layer
                 multi-tenant                     all repositories  
                 security                                           

  R14            Evaluation table  Low / High     Generate from     Results not
                 contains guessed                 script; mark      reproducible
                 values                           pending until run 
  -------------------------------------------------------------------------------------

## 2. Open decisions before scaffold

1.  **LLM provider and model:** not mandated by assignment. Choose based
    on API access, reliability, cost and structured/tool support; set
    via environment.
2.  **Embedding model and dimensions:** select once, record exact
    dimensions, and use consistently for documents and queries.
3.  **Tokenizer:** choose model-compatible tokenization for the 300/800
    comparison.
4.  **Overlap:** proposed 50 tokens for both sizes; confirm feasibility
    with chunker.
5.  **Retrieval threshold:** must be calibrated; do not hardcode an
    untested universal threshold.
6.  **Reranker:** choose a provider/local model only if feasible;
    otherwise clearly report the limitation.
7.  **Authentication:** assignment requires metadata/permission filters,
    but does not prescribe auth. Decide whether demo scope is
    single-user or implement minimal auth; never claim stronger
    guarantees than built.
8.  **Streaming protocol:** proposed SSE.
9.  **Duplicate response semantics:** return existing document ID and
    `duplicate=true` or a documented conflict response; idempotent
    success is preferred for this demo.
10. **Ticket confirmation UX:** pending action with expiry and explicit
    confirm button.
11. **Evaluation repetitions:** proposed at least 3 per
    question/configuration if time allows; at minimum run all 15 for
    both sizes and disclose repetition count.

## 3. Recommended tradeoffs to explain in interview

-   Modular monolith over microservices: less operational overhead,
    clear module boundaries.
-   PostgreSQL/pgvector over external vector DB: matches requirements
    and keeps data in one system.
-   Direct RAG over agent for ordinary questions: lower latency/cost and
    less nondeterminism.
-   Strict abstention over plausible guesses: trustworthiness over
    superficial answer rate.
-   Hybrid search only if measured: complexity should earn its place.
-   Explicit ticket confirmation: safe side-effect handling.
-   Bounded synchronous ingestion for demo: simple now; background
    workers if file sizes/traffic grow.

---

## 4. Production Readiness Hardening Risk Register

| ID | Severity | Finding | Evidence | Impact | Recommended Remediation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **P0** | Unrestricted API endpoints prone to resource exhaustion & DoS. | Endpoints `/documents`, `/chat`, `/tickets` had no rate limiting. | Client loops or malicious scraping could exhaust DB connections and LLM budget. | Implemented `SlidingWindowRateLimiter` middleware with route-specific quotas returning HTTP 429 & `Retry-After`. | `test_rate_limit.py` (3 unit tests) verifying 429 status code and retry window. | **RESOLVED** |
| **SEC-02** | **P0** | Hardcoded demo owner ID exposed without token authentication option. | `get_owner_id()` unconditionally returned `DEMO_OWNER_ID`. | In production, any user could modify any document or query other documents. | Added `AUTH_REQUIRED` and `API_KEY` validation supporting Bearer & X-API-Key tokens with `X-Owner-Id` tenant isolation. | `test_auth_isolation.py` (7 tests) verifying 401 on missing auth, 403 on invalid key, and tenant scoping. | **RESOLVED** |
| **SEC-03** | **P0** | Missing defensive HTTP security headers on API and Web. | Neither FastAPI nor Next.js set `nosniff`, `DENY`, or CSP headers. | Clickjacking, MIME-confusion, cross-site scripting risks. | Added `security_headers_middleware` in FastAPI and comprehensive security headers in `next.config.ts`. | `test_security_headers.py` verifying headers present on all responses. | **RESOLVED** |
| **OBS-01** | **P1** | Plain-text logs in production risking credential leaks. | Logs were printed in unstructured format without pattern scrubbing. | Exposed tokens could leak into centralized log collectors (Datadog/Loki). | Implemented `JSONLogFormatter` and `SensitiveDataFilter` redacting OpenAI keys, Bearer tokens, and DB passwords. | `test_logging_redaction.py` (4 tests) verifying automated regex pattern scrubbing. | **RESOLVED** |
| **OBS-02** | **P1** | Lack of real-time operational telemetry for Prometheus scrapers. | No `/metrics` endpoint existed; only `/health` and `/ready`. | SREs could not monitor error rates, latencies, or ingestion counts. | Created `/metrics` endpoint supporting Prometheus text and JSON exposition formats. | `test_security_headers.py` verifying `/metrics` returns Prometheus metrics format. | **RESOLVED** |
| **REL-01** | **P1** | Default database connection pooling in asyncpg. | `create_async_engine` did not specify pool size or timeouts. | Concurrent spikes could exhaust Postgres connections or trigger timeouts. | Configured `db_pool_size`, `db_max_overflow`, `db_pool_recycle_seconds`, and `db_pool_timeout_seconds` in `Settings`. | Engine initialization verified with pool parameters. | **RESOLVED** |
| **UI-01** | **P1** | Missing React error boundaries and 404 page. | Unhandled client exceptions caused white screen of death. | Poor user experience and lost recovery options on transient errors. | Added `apps/web/app/error.tsx` and `apps/web/app/not-found.tsx` with friendly recovery actions. | Next.js build compilation verified with error and not-found routes. | **RESOLVED** |
| **SEO-01** | **P2** | Private document routes lacked indexing protections. | No `robots.ts` or `sitemap.ts` existed in Next.js. | Search engine bots could attempt to crawl and index private documents or evaluation pages. | Implemented dynamic `robots.ts` disallowing `/documents`, `/evaluation`, `/login`, and `sitemap.ts`. | Next.js build verified generating `/robots.txt` and `/sitemap.xml`. | **RESOLVED** |
| **CICD-01** | **P2** | Absence of automated CI workflow on pull requests. | No `.github/workflows` existed. | Regressions could be merged undetected. | Created `.github/workflows/ci.yml` running pytest, ruff, mypy, tsc, lint, and build. | Workflow syntax validated against GitHub Actions specifications. | **RESOLVED** |
| **SEC-04** | **P0** | Tenant impersonation loophole via client-controlled `X-Owner-Id`. | Client could pass arbitrary `X-Owner-Id` alongside valid shared API key. | Any authenticated user could access another tenant's documents and orders. | Bound credentials strictly to tenant mappings (`TENANT_API_KEYS` / `DEFAULT_TENANT_ID`); reject mismatch with 403 FORBIDDEN. | `test_auth_isolation.py` (9 tests) verifying cross-tenant impersonation rejection. | **RESOLVED** |
| **SEC-05** | **P0** | Rate limiter bypass via spoofed `X-Forwarded-For` and memory DoS. | `X-Forwarded-For` was trusted unconditionally; memory table grew unboundedly. | Attackers could rotate headers to bypass rate limits or exhaust API server RAM. | Added socket peer validation against `trusted_proxies` and capped memory table at 10,000 tracked clients with LRU eviction. | `test_rate_limit.py` (6 tests) verifying proxy spoofing defense and memory capacity caps. | **RESOLVED** |
| **OBS-03** | **P1** | Unauthenticated `/metrics` exposing operational telemetry. | `/metrics` endpoint had no token validation. | External callers could scrape request rates, error counts, and internal latencies. | Restricted `/metrics` requiring `metrics_token` or valid API key in production mode. | `test_security_headers.py` verifying `/metrics` access enforcement and private cache headers. | **RESOLVED** |


