"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { checkHealth, listDocuments, streamChat, uploadDocument } from "@/lib/api";
import type { Citation, DocumentItem } from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  route?: string;
  citations?: Citation[];
  latencyMs?: number;
};

export default function Home() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [uploadState, setUploadState] = useState("Choose a PDF or TXT file, up to 10 MiB.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  async function refreshDocuments() {
    const items = await listDocuments();
    setDocuments(items);
    setSelected((current) => current.length ? current : items.filter((item) => item.status === "ready").map((item) => item.document_id));
  }

  useEffect(() => {
    const abort = new AbortController();
    Promise.all([checkHealth(abort.signal), listDocuments()])
      .then(([status, items]) => {
        setHealthy(status);
        setDocuments(items);
        setSelected(items.filter((item) => item.status === "ready").map((item) => item.document_id));
      })
      .catch(() => setHealthy(false));
    return () => abort.abort();
  }, []);

  async function onUpload(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setUploadState(`Uploading ${file.name}…`);
    try {
      const result = await uploadDocument(file);
      setUploadState(result.duplicate ? `Reused existing ${result.filename}.` : `${result.filename} is ready with ${result.chunk_count} chunks.`);
      await refreshDocuments();
      setSelected((current) => current.includes(result.document_id) ? current : [...current, result.document_id]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
      setUploadState("Upload failed. Choose a file to retry.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", text: "" }]);
    setQuestion("");
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const result = await streamChat(
        text,
        selected,
        (partial) => setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: partial } : item)),
        controller.current.signal,
      );
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: result.answer, route: result.route, citations: result.citations, latencyMs: result.latencyMs } : item));
    } catch (reason) {
      const message = reason instanceof DOMException && reason.name === "AbortError" ? "Response stopped." : reason instanceof Error ? reason.message : "Question failed.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== assistantId));
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }

  return (
    <main>
      <header>
        <div className="brand"><span className="mark">D</span><div><strong>DocuMind</strong><small>Grounded answers, visible evidence</small></div></div>
        <div className="health" data-ready={healthy === true}><span />{healthy === null ? "Checking API" : healthy ? "API connected" : "API unavailable"}</div>
      </header>

      <section className="intro">
        <p className="eyebrow">DOCUMENT INTELLIGENCE</p>
        <h1>Ask your documents.<br /><em>Trust the evidence.</em></h1>
        <p>Upload a source, ask a focused question, and inspect the exact passage behind every supported answer.</p>
      </section>

      <div className="workspace">
        <aside>
          <div className="panel-title"><span>01</span><div><h2>Sources</h2><p>PDF and plain text</p></div></div>
          <label className="upload">
            <input type="file" accept=".pdf,.txt,application/pdf,text/plain" disabled={busy} onChange={(event) => void onUpload(event.target.files?.[0])} />
            <span className="upload-icon">↑</span>
            <strong>Drop a document here</strong>
            <small>or click to browse</small>
          </label>
          <p className="upload-state" aria-live="polite">{uploadState}</p>
          <div className="documents">
            <h3>Available documents <span>{documents.length}</span></h3>
            {documents.length === 0 ? <p className="empty">No documents yet.</p> : documents.map((document) => (
              <label className="document" key={document.document_id}>
                <input
                  type="checkbox"
                  checked={selected.includes(document.document_id)}
                  disabled={document.status !== "ready"}
                  onChange={() => setSelected((current) => current.includes(document.document_id) ? current.filter((id) => id !== document.document_id) : [...current, document.document_id])}
                />
                <span className="file-icon">{document.filename.toLowerCase().endsWith(".pdf") ? "PDF" : "TXT"}</span>
                <span><strong>{document.filename}</strong><small>{document.status}</small></span>
              </label>
            ))}
          </div>
        </aside>

        <section className="chat" aria-label="Document chat">
          <div className="panel-title"><span>02</span><div><h2>Conversation</h2><p>{selected.length} source{selected.length === 1 ? "" : "s"} selected</p></div></div>
          <div className="messages" aria-live="polite">
            {messages.length === 0 && <div className="welcome"><div className="spark">✦</div><h2>What would you like to know?</h2><p>Ask about an uploaded document or try an order lookup such as “Where is ORD-1002?”</p></div>}
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-label">{message.role === "user" ? "You" : "DocuMind"}{message.route && <span>{message.route === "order_tool" ? "Order lookup" : "Document RAG"}</span>}</div>
                <p>{message.text || "Thinking…"}</p>
                {message.citations?.map((citation) => (
                  <details key={citation.chunk_id}>
                    <summary>{citation.document_name} · Chunk {citation.chunk_index}</summary>
                    <blockquote>{citation.quote}</blockquote>
                  </details>
                ))}
                {message.latencyMs !== undefined && <small className="latency">{message.latencyMs} ms</small>}
              </article>
            ))}
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <form onSubmit={(event) => void onSubmit(event)}>
            <label htmlFor="question">Ask a question</label>
            <textarea id="question" maxLength={4000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What does the document say about returns?" rows={2} />
            <div><small>Answers use selected documents. Order IDs route to the database tool.</small>{busy ? <button type="button" className="stop" onClick={() => controller.current?.abort()}>Stop</button> : <button type="submit" disabled={!question.trim()}>Ask <span>→</span></button>}</div>
          </form>
        </section>
      </div>
    </main>
  );
}
