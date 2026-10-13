"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import {
  confirmTicket,
  getAppMeta,
  listDocuments,
  prepareTicket,
  streamChat,
} from "@/lib/api";
import type { AppMeta, Citation, DocumentItem, PendingTicket } from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  route?: string;
  citations?: Citation[];
  latencyMs?: number;
};

export default function WorkspacePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    Promise.all([listDocuments(), getAppMeta()])
      .then(([items, appMeta]) => {
        setDocuments(items);
        setMeta(appMeta);
        setSelected(
          items
            .filter((item) => item.status === "ready")
            .map((item) => item.document_id),
        );
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load documents.",
        ),
      );
    return () => controller.current?.abort();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text },
      { id: assistantId, role: "assistant", text: "" },
    ]);
    setQuestion("");
    setBusy(true);
    setError("");
    setStage("Routing request");
    controller.current = new AbortController();
    try {
      const result = await streamChat(
        text,
        selected,
        (partial) =>
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId ? { ...item, text: partial } : item,
            ),
          ),
        controller.current.signal,
        (next) =>
          setStage(
            next === "retrieving"
              ? "Searching selected sources"
              : "Writing grounded answer",
          ),
      );
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: result.answer,
                route: result.route,
                citations: result.citations,
                latencyMs: result.latencyMs,
              }
            : item,
        ),
      );
      setActiveCitation(result.citations[0] ?? null);
    } catch (reason) {
      const message =
        reason instanceof DOMException && reason.name === "AbortError"
          ? "Response stopped."
          : reason instanceof Error
            ? reason.message
            : "Question failed.";
      setError(message);
      setMessages((current) =>
        current.filter((item) => item.id !== assistantId),
      );
    } finally {
      setBusy(false);
      setStage("");
      controller.current = null;
    }
  }

  return (
    <main className="workspace-page">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace</span>
          <h1>Document Assistant</h1>
        </div>
        <button
          className="secondary-button"
          onClick={() => setTicketOpen(true)}
        >
          <Icon name="plus" /> Support ticket
        </button>
      </header>
      <div className="workspace-grid">
        <section className="source-rail" aria-label="Selected sources">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Knowledge scope</span>
              <h2>Sources</h2>
            </div>
            <span className="count">{selected.length}</span>
          </div>
          <p className="muted-copy">
            Answers are restricted to the documents selected here.
          </p>
          <div className="source-list">
            {documents.map((document) => (
              <label className="source-option" key={document.document_id}>
                <input
                  type="checkbox"
                  checked={selected.includes(document.document_id)}
                  disabled={document.status !== "ready"}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(document.document_id)
                        ? current.filter((id) => id !== document.document_id)
                        : [...current, document.document_id],
                    )
                  }
                />
                <span
                  className={`file-chip ${document.filename.toLowerCase().endsWith(".pdf") ? "pdf" : "txt"}`}
                >
                  {document.filename.toLowerCase().endsWith(".pdf")
                    ? "PDF"
                    : "TXT"}
                </span>
                <span>
                  <strong>{document.filename}</strong>
                  <small>{document.status}</small>
                </span>
              </label>
            ))}
            {!documents.length && (
              <div className="compact-empty">
                <Icon name="file" />
                <p>No sources yet.</p>
              </div>
            )}
          </div>
          <Link className="text-link" href="/documents">
            <Icon name="upload" /> Manage documents
          </Link>
          <div className="tool-hint">
            <span className="pulse-dot" />
            <div>
              <strong>Controlled tools enabled</strong>
              <small>{meta ? `Try “Where is ${meta.order_example}?”` : "Order lookup is available"}</small>
            </div>
          </div>
        </section>
        <section className="conversation" aria-label="Document conversation">
          <div className="conversation-head">
            <div>
              <span className="online-dot" /> Assistant ready
            </div>
            <span>
              {selected.length} source{selected.length === 1 ? "" : "s"} active
            </span>
          </div>
          <div className="messages" aria-live="polite">
            {!messages.length && (
              <div className="chat-empty">
                <div className="assistant-mark">D</div>
                <span className="eyebrow">Grounded document intelligence</span>
                <h2>
                  Ask a precise question.
                  <br />
                  Inspect the evidence.
                </h2>
                <p>
                  DocuMind searches only your selected sources and returns
                  citations you can verify.
                </p>
                <div className="suggestion-row">
                  {meta?.suggested_questions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQuestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-meta">
                  <strong>
                    {message.role === "user" ? "You" : "DocuMind"}
                  </strong>
                  {message.route && (
                    <span>
                      {message.route === "order_tool"
                        ? "Database tool"
                        : "Hybrid RAG"}
                    </span>
                  )}
                </div>
                <p>
                  {message.text || (
                    <span className="typing">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </p>
                {!!message.citations?.length && (
                  <div className="citation-buttons">
                    {message.citations.map((citation, index) => (
                      <button
                        key={citation.chunk_id}
                        onClick={() => setActiveCitation(citation)}
                      >
                        <span>{index + 1}</span>
                        {citation.document_name}
                      </button>
                    ))}
                  </div>
                )}
                {message.latencyMs !== undefined && (
                  <small className="latency">
                    Completed in {message.latencyMs} ms
                  </small>
                )}
              </article>
            ))}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>!</span>
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          <form className="composer" onSubmit={(event) => void onSubmit(event)}>
            <textarea
              aria-label="Ask a question"
              maxLength={meta?.max_query_chars}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask about your selected documents…"
              rows={3}
            />
            <div>
              <small>
                {busy ? stage : "Enter to send · Shift + Enter for a new line"}
              </small>
              {busy ? (
                <button
                  type="button"
                  className="stop-button"
                  onClick={() => controller.current?.abort()}
                >
                  Stop
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  disabled={!question.trim()}
                  aria-label="Send question"
                >
                  <Icon name="send" />
                </button>
              )}
            </div>
          </form>
        </section>
        <aside className="citation-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Verification</span>
              <h2>Source evidence</h2>
            </div>
          </div>
          {activeCitation ? (
            <div className="citation-detail">
              <div className="source-file">
                <span className="file-chip">
                  {activeCitation.document_name.endsWith(".pdf")
                    ? "PDF"
                    : "TXT"}
                </span>
                <div>
                  <strong>{activeCitation.document_name}</strong>
                  <small>
                    Chunk {activeCitation.chunk_index + 1}
                    {activeCitation.page_start
                      ? ` · Page ${activeCitation.page_start}`
                      : ""}
                  </small>
                </div>
              </div>
              {activeCitation.section && (
                <span className="section-tag">{activeCitation.section}</span>
              )}
              <blockquote>{activeCitation.quote}</blockquote>
              <Link
                className="text-link"
                href={`/documents/${activeCitation.document_id}`}
              >
                Open document context →
              </Link>
            </div>
          ) : (
            <div className="evidence-empty">
              <div className="evidence-lines">
                <i />
                <i />
                <i />
                <i />
              </div>
              <h3>Citations appear here</h3>
              <p>
                Ask a document question, then select a citation to inspect its
                stored source text.
              </p>
            </div>
          )}
          <div className="trust-note">
            <Icon name="check" />
            <p>
              <strong>Validated citations</strong>
              <br />
              IDs are checked against authorized retrieved chunks.
            </p>
          </div>
        </aside>
      </div>
      {ticketOpen && <TicketDialog meta={meta} onClose={() => setTicketOpen(false)} />}
    </main>
  );
}

function TicketDialog({ meta, onClose }: { meta: AppMeta | null; onClose: () => void }) {
  const [draft, setDraft] = useState({
    subject: "",
    description: "",
    order_number: "",
  });
  const [pending, setPending] = useState<PendingTicket | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function prepare(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setPending(
        await prepareTicket({
          ...draft,
          order_number: draft.order_number || undefined,
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not prepare ticket.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const ticket = await confirmTicket(pending.pending_action_id);
      setResult(`${ticket.ticket_number} created successfully.`);
      setPending(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create ticket.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">Controlled write action</span>
            <h2 id="ticket-title">Create support ticket</h2>
          </div>
          <button onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>
        {result ? (
          <div className="ticket-success">
            <span>
              <Icon name="check" />
            </span>
            <h3>Ticket created</h3>
            <p>{result}</p>
            <button onClick={onClose}>Done</button>
          </div>
        ) : pending ? (
          <div className="confirmation">
            <p>Review this action before anything is written:</p>
            <strong>{pending.summary}</strong>
            <small>
              Confirmation expires{" "}
              {new Date(pending.expires_at).toLocaleTimeString()}.
            </small>
            <div>
              <button
                className="secondary-button"
                onClick={() => setPending(null)}
              >
                Go back
              </button>
              <button onClick={() => void confirm()} disabled={busy}>
                Confirm and create
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void prepare(event)}>
            <label>
              Subject
              <input
                required
                minLength={3}
                maxLength={200}
                value={draft.subject}
                onChange={(event) =>
                  setDraft({ ...draft, subject: event.target.value })
                }
                placeholder="Delivery delay"
              />
            </label>
            <label>
              Order number <small>(optional)</small>
              <input
                value={draft.order_number}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    order_number: event.target.value.toUpperCase(),
                  })
                }
                placeholder={meta?.order_example}
                pattern={meta?.order_number_pattern}
              />
            </label>
            <label>
              Description
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                placeholder="Describe what happened and how support can help."
              />
            </label>
            <button type="submit" disabled={busy}>
              Review ticket
            </button>
          </form>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}
