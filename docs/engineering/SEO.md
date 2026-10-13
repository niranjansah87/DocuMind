# Technical SEO & Discoverability Policy

## 1. Objectives & Boundaries

DocuMind is an enterprise document assistant designed for confidential knowledge documents. The primary SEO imperative is:

> **Never allow private customer documents, user prompts, citations, or operational data to be indexed by public search engines.**

Search engine indexing is strictly restricted to public brand and landing surfaces.

---

## 2. Route Classification Matrix

| Route | Type | Indexable? | Enforced Controls |
| :--- | :--- | :---: | :--- |
| `/` | Public Workspace / Landing | **Yes** | Standard metadata, canonical URL, Open Graph card, Twitter card. |
| `/documents` | Private Document Repository | **No** | `robots: { index: false, follow: false }`, excluded from `sitemap.xml`, disallow in `robots.txt`. |
| `/documents/[id]` | Private Document Viewer | **No** | Inherits `noindex` from layout, excluded from `sitemap.xml`, disallow in `robots.txt`. |
| `/evaluation` | Internal RAG Benchmark | **No** | `robots: { index: false, follow: false }`, excluded from `sitemap.xml`, disallow in `robots.txt`. |
| `/api/*` | Backend REST Endpoints | **No** | Disallow in `robots.txt`, noindex headers. |
| `/health`, `/ready`, `/metrics` | Operational Probes | **No** | Disallow in `robots.txt`, internal metrics cache-control. |

---

## 3. Metadata & Sitemap Architecture

### 3.1 Metadata Strategy
- **Base URL:** Defined via `NEXT_PUBLIC_SITE_URL` (defaults to production canonical domain).
- **OpenGraph & Twitter Card:** Custom preview image pointing to `/logo.png`, structured descriptions highlighting grounded RAG and security guardrails.
- **Favicons:** Canonical `/favicon.ico` and Apple touch icon `/logo_mark.png`.

### 3.2 Dynamic `robots.txt` (`app/robots.ts`)
```typescript
{
  rules: [
    {
      userAgent: "*",
      allow: ["/$"],
      disallow: [
        "/documents",
        "/documents/*",
        "/evaluation",
        "/api/*",
        "/health",
        "/ready",
        "/metrics",
      ],
    },
  ],
  sitemap: "https://documind.niranjansah87.com.np/sitemap.xml",
}
```

### 3.3 Dynamic `sitemap.xml` (`app/sitemap.ts`)
Only the public root `/` is published in `sitemap.xml`. No user-uploaded document IDs or generated content may ever appear in the sitemap.
