# Security Policy — DocuMind

## 1. Supported Versions

DocuMind is an active project. Only the latest release on the primary development branch receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## 2. Reporting a Vulnerability

If you discover a security vulnerability within DocuMind, please do not disclose it publicly in issues or pull requests.

Instead, please send an encrypted or private email report to:
* **Contact:** `security@niranjansah87.com.np` (or open a GitHub Security Advisory)
* **Response Time:** Initial response within 48 hours with vulnerability triage status.

Please include:
1. Description of the vulnerability and its potential impact.
2. Step-by-step reproduction steps or proof-of-concept payload.
3. Affected components (API endpoints, ingestion parser, retrieval, agent tools, frontend).

---

## 3. Threat Model & Security Boundaries

DocuMind implements defense-in-depth principles across its full-stack RAG and tool architecture:

### 3.1 Untrusted Document Context
* **Adversarial Injections:** All uploaded documents (PDF, TXT) are treated as untrusted data. Retrieved document chunks are enclosed inside strict `<untrusted_context>` tags with explicit system instructions to ignore embedded commands.
* **Citation Grounding:** Citations returned by the model are strictly verified server-side against the candidate chunks retrieved for that user session. Fabricated citation IDs are dropped, triggering honest abstention.

### 3.2 Controlled Tools & Agent Guardrails
* **No Arbitrary Code/SQL:** The agent uses a static, hardcoded tool registry (`search_docs`, `get_order_status`, `create_ticket`). The LLM cannot execute shell commands, SQL, or arbitrary API calls.
* **Two-Step Ticket Confirmation:** Ticket creation is an active write action. It requires a server-issued, cryptographically random, expiring (10-minute TTL), single-use pending action token. The database row is locked and validated to prevent replay attacks or parameter tampering.
* **Bounded Steps:** Agent tool execution is strictly capped by `max_tool_steps` (default 4) and timeouts to prevent infinite tool loops.

### 3.3 File Ingestion Restrictions
* **Allowed Extensions:** Only `.pdf` and `.txt` are accepted.
* **Magic Byte Validation:** Files are validated by magic bytes (e.g. `%PDF-` header for PDF) to reject spoofed extensions.
* **Byte Size Limits:** Server-side upload cap enforced (`max_upload_bytes`, default 10 MB).
* **Deduplication:** Uploaded content is hashed with SHA-256 and unique within the owner scope to prevent database flooding.

### 3.4 API & Network Security
* **Single Domain Reverse Proxy:** The FastAPI backend is bound to `127.0.0.1:8888` (internal only) and never exposed directly to the public internet. All traffic routes through Nginx under `https://documind.niranjansah87.com.np/api/`.
* **Zero Credential Exposure:** Provider credentials (`OPENAI_API_KEY`) and database credentials are kept exclusively server-side. The frontend client uses relative same-origin paths, ensuring no backend tokens or endpoints appear in browser network tabs.
* **Security Headers:** Strict Transport Security (`HSTS`), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and restrictive Referrer and Permissions policies.

