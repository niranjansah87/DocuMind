# Frontend UX Specification

## 1. Scope

A single responsive page is sufficient. Optimize for a clear reviewer
walkthrough, not a large product surface.

## 2. Page layout

-   Header: DocuMind name and API connection/health state.
-   Upload panel: drag/drop or file picker; supported formats PDF/TXT;
    configured size limit; upload progress/status; duplicate notice.
-   Document list: filename, ingestion status, chunk count if available,
    selected-document control.
-   Chat panel: message history, text input, submit button, stop/cancel
    if streaming supports it.
-   Answer region: streaming answer text, route/mode indicator,
    citations with document name, chunk index, section/page, and
    expandable excerpt.
-   Error feedback: concise error message and retry affordance where
    retry is safe.
-   Empty states: explain how to upload a document before asking
    document questions.

## 3. Interaction states

### Upload

-   Idle → uploading → processing → ready.
-   Duplicate → show that existing content was reused.
-   Invalid type/size → inline validation message.
-   Parse/provider failure → explain that ingestion failed and allow
    retry.
-   Prevent accidental double-submit while upload is in progress.

### Chat

-   Idle → submitting → streaming → complete.
-   Keep citations associated with the final answer; do not display
    unvalidated model-supplied citations as trusted.
-   On network failure, show retry. Retrying read-only questions is
    safe; ticket creation must be idempotent and confirmation-aware.
-   Unknown response should be explicit, not a blank answer or generic
    error.
-   Tool route should visibly indicate "Order lookup" or equivalent so
    the reviewer can verify the route.

### Ticket

-   Show action summary and require explicit confirmation.
-   Confirmation must be a deliberate button/action; typing a vague
    "okay" should not be treated as confirmation unless tied to a
    pending action and intentionally designed.
-   Display the created ticket ID after confirmed success.

## 4. Accessibility and quality

-   Keyboard-operable upload/chat controls.
-   Visible focus states and labels.
-   Error states announced accessibly.
-   Do not rely on color alone for status.
-   Render source excerpts as escaped text, not arbitrary HTML.
-   Keep long citations readable on mobile.
-   Preserve answer text while streaming; avoid layout jumps where
    practical.

## 5. Frontend/API contract

Use a single typed API client module. Centralize base URL and error
parsing. Do not call the LLM provider from the browser. If SSE is used,
define how status, token, citations, done and error events are parsed,
and close the stream on completion/unmount.
