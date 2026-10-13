# Frontend Architecture and UX Specification

## 1. Overview and Design Fidelity

DocuMind's frontend is built with Next.js 16 (App Router), React 19, TypeScript, and native CSS styling faithfully reproducing the four visual mockups in `design/`:
1. `Documind_workspace.png` → Route `/` (Workspace & Chat)
2. `documind_documents_page.png` → Route `/documents` (Documents repository & drawer)
3. `documind_documents_details_page.png` → Route `/documents/[id]` (Deep document inspection & PDF viewer)
4. `documind_evaluation_page.png` → Route `/evaluation` (RAG benchmark evaluation & gold questions)

All page layouts adhere to strict typographic hierarchy, responsive sidebars, custom SVG iconography (no generic emojis), designated brand assets (`logo.png`, `logo_mark.png`), and smooth micro-interactions.

---

## 2. Global Navigation & Layout Shell (`AppShell`)

- **Sidebar (Left):**
  - **Brand Header:** DocuMind logo mark, title, and collapse toggle.
  - **Primary Action:** `+ New Chat` button with `Ctrl K` keyboard shortcut badge.
  - **Main Navigation:**
    - `Workspace` (`/`) — Active chat interface.
    - `Documents` (`/documents`) — Document repository.
    - `Evaluation` (`/evaluation`) — Benchmark suite with distinctive `Beta` badge pill.
  - **Recent Conversations Rail:**
    - Categorized conversational threads with relative time tags (e.g. `2m ago`, `1h ago`, `Yesterday`).
    - Active selection highlight with options menu.
  - **User Profile Footer:**
    - User avatar, name (`Niranjan Sah`), and workspace tag (`Personal Workspace`).

---

## 3. Route Specifications

### 3.1 Workspace & Chat (`/`) — Matching `Documind_workspace.png`
- **Document Header Banner:**
  - Active document icon (PDF/TXT), filename, ingestion status (`Ready` green badge), chunk count, file size, and upload recency.
  - Action buttons: Share, Document Settings, and Quick Upload.
- **Chat Feed:**
  - Distinct user message bubbles and assistant responses.
  - Search banner indicator: `Found X relevant chunks in <filename>` with confidence scoring.
  - Inline citation pills (e.g. `[1]`, `[2]`) linked to active citations in the right inspector.
  - Message action row: Copy, Thumbs Up / Down, Model latency badge (`1.4s`), and Token count.
  - Suggested follow-up questions pills for quick exploration.
- **Floating Input Bar:**
  - Selected document chip with remove affordance.
  - Clean text input with auto-expanding capability.
  - Web search toggle switch (`Search Web`).
  - Attachment file picker and circular send/submit button.
- **Collapsible Sources Inspector (Right Panel):**
  - Tabs: `Sources (N)`, `Details`, `Related`.
  - Rich document thumbnail cards with page badges and relevance percentages.
  - Highlighted excerpt quote cards matching inline citation selections.
- **Support Ticket Confirmation Modal:**
  - Triggered by ticket intent or UI action.
  - Two-stage flow: Draft/Summary preview → Explicit Confirm button.
  - Displays generated ticket number (e.g. `TKT-D47003EF`) upon confirmation.

### 3.2 Documents Repository (`/documents`) — Matching `documind_documents_page.png`
- **Top Upload Banner:**
  - Prominent banner with format support indicator (`PDF, TXT • Max 10 MB • Engine: text-embedding-3-small`).
  - Direct file upload button with native file chooser.
- **Filter & Search Bar:**
  - Status filter pills: `All`, `Completed`, `Processing`, `Failed`.
  - Instant text search input filtering documents by name and description.
- **Documents Table:**
  - Columns: Checkbox, Name + Description subtext, Type pill (PDF red / TXT blue), File Size, Chunks count, Status badge with status dot, Uploaded date/time, and Action menu dots.
  - Click row to select document for inspector drawer; double-click or view action to open full deep viewer.
  - Pagination controls (`Showing 1-N of N documents`).
- **Slide-out Detail Drawer (Right):**
  - Large file icon and title header.
  - Metadata key-value list (Format, Size, Upload Date, Processed At, Chunks, Tokens).
  - Processing Timeline checklist: File uploaded → Text extracted → Chunks generated → Vectors embedded.
  - Tabbed sub-views: `Overview`, `Chunks`, `Preview`.
  - Drawer action footer: `Chat with this document` and `View in chat →`.

### 3.3 Deep Document Inspection (`/documents/[id]`) — Matching `documind_documents_details_page.png`
- **Top Breadcrumbs & Toolbar:**
  - Breadcrumb navigation: `Documents > <Filename>`.
  - Actions: `Download`, `Delete`, `Open in Chat`.
- **Dual-Pane Document Viewer:**
  - **Left Thumbnail Rail:** Vertical thumbnails for each page with active page indicator.
  - **Center Canvas:** Rendered document page sheet with zoom controls (`Zoom In`, `Zoom Out`, `Fit`), page navigation buttons, and yellow-highlighted source quote overlays matching retrieved citations.
- **Right Document Inspector:**
  - Deep chunk inspection tabs: `Details`, `Chunks`, `Related`.
  - Chunk boundaries viewer showing token count, section headers, character offsets, and vector dimensions.

### 3.4 Evaluation Suite (`/evaluation`) — Matching `documind_evaluation_page.png`
- **Benchmark Header:**
  - Title and comparative description.
  - `Run Evaluation` action button with live progress indicator.
- **Selectors Bar:**
  - Document selector, Chunk size comparison toggles (`300 tokens` vs `800 tokens`), and Gold Questions selector.
- **Dual-Metric Comparison Cards:**
  - 4 cards comparing 300 vs 800 token configurations:
    1. `Retrieval Accuracy`: 73% vs 87% (+14% improvement).
    2. `Answer Correctness`: 67% vs 80% (+13% improvement).
    3. `Response Time`: 2.8s vs 3.6s (+0.8s tradeoff).
    4. `Context Redundancy`: 24% vs 11% (-13% reduction).
- **Interactive SVG Visualizations:**
  1. `Accuracy by Question Category`: Clustered bar chart comparing policy, eligibility, exceptions, and order lookup.
  2. `Response Time per Question`: Dual-line trend chart showing latency per question.
  3. `Chunk Distribution`: Histogram showing retrieved chunk count frequency.
- **15 Gold Questions Results Table:**
  - Filter pills: `All (15)`, `Correct (13)`, `Partial (1)`, `Incorrect (1)`.
  - Columns: `#`, `Question`, `Target Section (Page)`, `300 Tokens Status`, `800 Tokens Status`, `Latency`.
- **Right Insights & Dataset Sidebar:**
  - `Insights` narrative explaining why 800 tokens with hybrid retrieval is optimal.
  - `Recommended Chunk Size`: 800 tokens badge with green checkmark.
  - `Evaluation Dataset`: 15 questions badge with instant JSON download action (`gold_questions.json`).

---

## 4. Accessibility & Resiliency

- **Keyboard Navigation:** Full tab order and ARIA attributes on modals, tabs, and tables.
- **Input Sanitization:** Escaped HTML rendering prevents XSS from untrusted documents.
- **Error Boundaries:** Friendly error banners with retry buttons on network timeouts.
- **Live Stream Handling:** Server-Sent Events stream with clean disconnection and abort controller on navigation.
