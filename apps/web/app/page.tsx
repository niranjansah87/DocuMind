"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  confirmTicket,
  getAppMeta,
  listDocuments,
  prepareTicket,
  streamChat,
  uploadDocument,
} from "@/lib/api";
import {
  getActiveConversationId,
  getConversation,
  saveConversation,
  setActiveConversationId,
  type ChatMessage,
} from "@/lib/conversations";
import type { AppMeta, Citation, DocumentItem, PendingTicket } from "@/lib/types";

type Message = ChatMessage;

const DEFAULT_SUGGESTIONS = [
  "What items are not eligible for refund?",
  "How long does a refund take?",
  "What is the return process?",
];

/**
 * doc-mind-ai: Single-page DocuMind workspace.
 *
 * Provides a responsive three-pane layout featuring:
 * 1. Document upload area with drag-and-drop, validation, and real-time status indicators.
 * 2. Conversational chat interface displaying streamed tokens and intent routing badges.
 * 3. Grounded citation list and inspector with chunk excerpts, page numbers, and section titles.
 */
export default function WorkspacePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [activeDocId, setActiveDocId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const activeId = getActiveConversationId();
    if (activeId) {
      const conv = getConversation(activeId);
      if (conv?.documentId) return conv.documentId;
    }
    return "";
  });
  const [currentConvId, setCurrentConvId] = useState<string>(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    return getActiveConversationId() || crypto.randomUUID();
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    const activeId = getActiveConversationId();
    if (activeId) {
      const conv = getConversation(activeId);
      if (conv?.messages) return conv.messages;
    }
    return [];
  });
  const [question, setQuestion] = useState("");
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"sources" | "details" | "related">("sources");
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamAnimRef = useRef<number | null>(null);
  const streamBufferRef = useRef({ target: "", rendered: "", done: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const [items, appMeta] = await Promise.all([listDocuments(), getAppMeta()]);
        if (!isMounted) return;
        setDocuments(items);
        setMeta(appMeta);
        if (items.length > 0) {
          const readyDoc = items.find((d) => d.status === "ready") || items[0];
          setActiveDocId((curr) => curr || readyDoc.document_id);
        }
      } catch (reason) {
        if (!isMounted) return;
        setError(reason instanceof Error ? reason.message : "Could not load documents.");
      }
    })();


    // Listen to global events from sidebar
    const handleNewChat = () => {
      const newId = crypto.randomUUID();
      setCurrentConvId(newId);
      setActiveConversationId(newId);
      setMessages([]);
      setError("");
      setQuestion("");
    };

    const handleLoadConversation = (e: CustomEvent<string>) => {
      const convId = e.detail;
      const conv = getConversation(convId);
      if (conv) {
        setCurrentConvId(conv.id);
        setActiveConversationId(conv.id);
        setMessages(conv.messages);
        if (conv.documentId) {
          setActiveDocId(conv.documentId);
        }
        setError("");
        toast.info(`Loaded: ${conv.title}`);
      }
    };

    const handleLoadPrompt = (e: CustomEvent<string>) => {
      setQuestion(e.detail);
    };

    window.addEventListener("documind:new-chat", handleNewChat as EventListener);
    window.addEventListener(
      "documind:load-conversation",
      handleLoadConversation as EventListener,
    );
    window.addEventListener("documind:load-prompt", handleLoadPrompt as EventListener);

    return () => {
      isMounted = false;
      window.removeEventListener("documind:new-chat", handleNewChat as EventListener);
      window.removeEventListener(
        "documind:load-conversation",
        handleLoadConversation as EventListener,
      );
      window.removeEventListener("documind:load-prompt", handleLoadPrompt as EventListener);
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth" });
  }, [messages, busy]);

  const refreshDocuments = async () => {
    try {
      const [items, appMeta] = await Promise.all([listDocuments(), getAppMeta()]);
      setDocuments(items);
      setMeta(appMeta);
      if (items.length > 0) {
        const readyDoc = items.find((d) => d.status === "ready") || items[0];
        setActiveDocId((curr) => curr || readyDoc.document_id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load documents.");
    }
  };

  const activeDoc = documents.find((d) => d.document_id === activeDocId) || documents[0];

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await uploadDocument(file);
      await refreshDocuments();
      setActiveDocId(result.document_id);
      toast.success(`"${file.name}" uploaded successfully.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendQuestion = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || busy) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const assistantId = crypto.randomUUID();

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text, time: currentTime },
      { id: assistantId, role: "assistant", text: "", time: currentTime },
    ]);
    setQuestion("");
    setBusy(true);
    setError("");
    setStage("Searching documents");
    setInspectorOpen(true);
    controller.current = new AbortController();

    const docIds = activeDocId ? [activeDocId] : documents.map((d) => d.document_id);
    setStreamingMessageId(assistantId);

    streamBufferRef.current = { target: "", rendered: "", done: false };
    const buf = streamBufferRef.current;

    // Smooth token streaming loop running at display refresh rate
    const runStreamTick = () => {
      if (buf.rendered.length < buf.target.length) {
        const diff = buf.target.length - buf.rendered.length;
        const step = diff > 80 ? 5 : diff > 35 ? 3 : diff > 10 ? 2 : 1;
        buf.rendered = buf.target.slice(0, buf.rendered.length + step);
        const textToDisplay = buf.rendered;
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, text: textToDisplay } : item)),
        );
      }
      if (!buf.done || buf.rendered.length < buf.target.length) {
        streamAnimRef.current = requestAnimationFrame(runStreamTick);
      }
    };
    streamAnimRef.current = requestAnimationFrame(runStreamTick);

    try {
      // Gather previous conversation turns (excluding the newly appended prompt and placeholder)
      const chatHistory = messages
        .filter((m) => m.text.trim().length > 0)
        .slice(-6)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text.slice(0, 1500),
        }));

      const result = await streamChat(
        text,
        docIds,
        (partial) => {
          buf.target = partial;
        },
        controller.current.signal,
        (next) =>
          setStage(next === "retrieving" ? "Searching documents" : "Formulating answer"),
        chatHistory,
      );

      buf.done = true;
      buf.target = result.answer;

      // Allow remaining tokens to smoothly complete into view
      while (buf.rendered.length < buf.target.length) {
        await new Promise((r) => setTimeout(r, 16));
        const diff = buf.target.length - buf.rendered.length;
        const step = Math.max(2, Math.ceil(diff / 3));
        buf.rendered = buf.target.slice(0, buf.rendered.length + step);
        const textToDisplay = buf.rendered;
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, text: textToDisplay } : item)),
        );
      }

      setMessages((current) => {
        const next = current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: result.answer,
                route: result.route,
                citations: result.citations,
                latencyMs: result.latencyMs,
              }
            : item,
        );
        saveConversation(currentConvId, next, {
          id: activeDoc?.document_id,
          name: activeDoc?.filename,
        });
        return next;
      });

      if (result.citations && result.citations.length > 0) {
        setActiveCitation(result.citations[0]);
      }
    } catch (reason) {
      if (streamAnimRef.current) {
        cancelAnimationFrame(streamAnimRef.current);
      }
      const msg =
        reason instanceof DOMException && reason.name === "AbortError"
          ? "Generation stopped."
          : reason instanceof Error
            ? reason.message
            : "Question failed.";
      setError(msg);
      setMessages((current) => current.filter((item) => item.id !== assistantId));
    } finally {
      streamBufferRef.current.done = true;
      if (streamAnimRef.current) {
        cancelAnimationFrame(streamAnimRef.current);
      }
      setStreamingMessageId(null);
      setBusy(false);
      setStage("");
      controller.current = null;
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendQuestion(question);
  };

  // Find all citations from current messages
  const allCitations: Citation[] = [];
  messages.forEach((m) => {
    if (m.citations) {
      m.citations.forEach((c) => {
        if (!allCitations.some((existing) => existing.chunk_id === c.chunk_id)) {
          allCitations.push(c);
        }
      });
    }
  });

  return (
    <main className="workspace-main">
      {/* Top Header Bar matching Documind_workspace.png */}
      <header className="workspace-header">
        <div className="workspace-doc-info">
          <div className={`doc-icon-badge ${activeDoc?.mime_type === "application/pdf" ? "pdf" : "txt"}`}>
            <Icon name={activeDoc?.mime_type === "application/pdf" ? "pdf" : "txt"} size={20} />
          </div>
          <div className="doc-meta-text">
            {activeDoc ? (
              <>
                <div className="doc-title-row">
                  <span className="doc-filename">{activeDoc.filename}</span>
                  <span className={`doc-status-pill ${activeDoc.status}`}>
                    {activeDoc.status === "ready" ? "Ready" : activeDoc.status === "processing" ? "Processing" : "Failed"}
                  </span>
                </div>
                <div className="doc-subtitle-row">
                  <span>
                    {activeDoc.page_count != null ? `${activeDoc.page_count} ${activeDoc.page_count === 1 ? "page" : "pages"}` : "Text document"} •{" "}
                    {activeDoc.byte_size >= 1024 * 1024
                      ? `${(activeDoc.byte_size / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.round(activeDoc.byte_size / 1024)} KB`}{" "}
                    • Uploaded {new Date(activeDoc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="doc-title-row">
                  <span className="doc-filename">No document selected</span>
                  <span className="doc-status-pill ready">Upload a document to begin</span>
                </div>
                <div className="doc-subtitle-row">
                  <span>Upload a PDF or TXT file to start chatting</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="workspace-header-actions">
          <button
            className="header-action-button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload new document"
          >
            <Icon name="file" size={16} />
            <span>Add Document</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="visually-hidden"
            accept=".pdf,.txt"
            onChange={handleUpload}
          />
          <button
            className="header-icon-button"
            onClick={() => setTicketModalOpen(true)}
            title="Create support ticket or order lookup"
          >
            <Icon name="more" size={18} />
          </button>
        </div>
      </header>

      {/* Main Body: Chat on left, Sources Inspector on right */}
      <div className="workspace-body">
        {/* Chat Area */}
        <section className="chat-area">
          <div className="chat-messages-container">
            {messages.length === 0 ? (
              <motion.div
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                className="chat-welcome-empty"
              >
                <div className="welcome-avatar">
                  <Image src="/logo_mark.png" alt="DocuMind Logo" width={48} height={48} priority />
                </div>
                <h2>DocuMind Document Assistant</h2>
                <p>
                  Ask grounded questions about your uploaded documents, look up order statuses,
                  or create support tickets with full verification.
                </p>
                <div className="welcome-suggestions">
                  {DEFAULT_SUGGESTIONS.map((item) => (
                    <motion.button
                      key={item}
                      className="welcome-pill"
                      onClick={() => void sendQuestion(item)}
                      whileHover={{ scale: 1.015, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                    >
                      <span>{item}</span>
                      <Icon name="chevron-right" size={14} />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                      className="user-message-row"
                    >
                      <div className="user-message-content">
                        <div className="user-message-bubble">{message.text}</div>
                        <div className="message-timestamp">{message.time ?? "10:24 AM"}</div>
                      </div>
                      <div className="user-msg-avatar">N</div>
                    </motion.div>
                  );
                }

                // Assistant message
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="assistant-message-row"
                  >
                    <div className="assistant-msg-avatar">
                      <Image src="/logo_mark.png" alt="DocuMind" width={32} height={32} />
                    </div>
                    <div className="assistant-message-card">
                      {/* Search indicator banner */}
                      {(message.citations && message.citations.length > 0) ? (
                        <div
                          className="searched-documents-banner"
                          onClick={() => {
                            if (message.citations && message.citations.length > 0) {
                              setActiveCitation(message.citations[0]);
                              setActiveTab("sources");
                              setInspectorOpen(true);
                            }
                          }}
                          title="Click to view verified source chunks in Inspector"
                        >
                          <div className="searched-banner-left">
                            <Icon name="check-circle" size={16} className="text-emerald-600" />
                            <span className="searched-title">Grounded in documents</span>
                            <span className="searched-count">
                              {message.citations.length} verified citation{message.citations.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <Icon name="chevron-right" size={14} className="text-emerald-700" />
                        </div>
                      ) : message.route === "order_tool" ? (
                        <div className="searched-documents-banner bg-indigo-50 border-indigo-200">
                          <div className="searched-banner-left">
                            <Icon name="tune" size={16} className="text-indigo-600" />
                            <span className="searched-title text-indigo-700">Database tool executed</span>
                            <span className="searched-count text-indigo-600">
                              Order lookup verified
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {/* Message text */}
                      <div className="assistant-text-content">
                        {message.text ? (
                          <MarkdownRenderer
                            content={message.text}
                            isStreaming={streamingMessageId === message.id}
                            citations={message.citations}
                            onCitationClick={(c) => {
                              setActiveCitation(c);
                              setActiveTab("sources");
                              setInspectorOpen(true);
                            }}
                          />
                        ) : (
                          <div className="streaming-indicator">
                            <span className="streaming-dot" />
                            <span className="streaming-dot" />
                            <span className="streaming-dot" />
                            <span className="streaming-text">{stage || "Generating response..."}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons row */}
                      {message.text && (
                        <div className="assistant-action-row">
                          <div className="action-buttons-group">
                            <button
                              className="msg-action-btn"
                              onClick={() => handleCopy(message.id, message.text)}
                              title="Copy response"
                            >
                              <Icon name="copy" size={15} />
                              {copiedId === message.id && <span className="copied-tooltip">Copied</span>}
                            </button>
                          </div>
                          <span className="action-timestamp">{message.time ?? "10:24 AM"}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions bar */}
          {messages.length > 0 && <div className="suggested-questions-container">
            <span className="suggested-label">Suggested questions</span>
            <div className="suggested-pills-row">
              {DEFAULT_SUGGESTIONS.map((item) => (
                <motion.button
                  key={item}
                  className="suggested-pill-card"
                  onClick={() => void sendQuestion(item)}
                  disabled={busy}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                >
                  <span>{item}</span>
                  <Icon name="chevron-right" size={13} />
                </motion.button>
              ))}
            </div>
          </div>}

          {/* Floating Chat Input Bar */}
          <div className="chat-composer-wrapper">
            {error && (
              <div className="composer-error-banner">
                <Icon name="alert-circle" size={16} />
                <span className="flex-1">{error}</span>
                {(error.toLowerCase().includes("credential") ||
                  error.toLowerCase().includes("unauthorized") ||
                  error.toLowerCase().includes("forbidden") ||
                  error.toLowerCase().includes("401") ||
                  error.toLowerCase().includes("403")) && (
                  <Link
                    href="/login"
                    className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    Authenticate →
                  </Link>
                )}
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}

            <form className="chat-composer-form" onSubmit={onSubmit}>
              <textarea
                className="composer-textarea"
                rows={2}
                placeholder="Ask a question about your document..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (question.trim() && !busy) {
                      void sendQuestion(question);
                    }
                  }
                }}
              />

              <div className="composer-bottom-bar">
                <div className="composer-bar-left">
                  <button
                    type="button"
                    className="composer-icon-button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach document"
                  >
                    <Icon name="paperclip" size={17} />
                  </button>

                  {activeDoc && (
                    <div className="active-doc-pill">
                      <Icon name="file" size={13} />
                      <span className="active-doc-name">Document: {activeDoc.filename}</span>
                      <button
                        type="button"
                        className="doc-pill-remove"
                        onClick={() => setActiveDocId("")}
                        title="Remove document scope"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="composer-icon-button"
                    onClick={() => setTicketModalOpen(true)}
                    title="Support ticket / Order lookup"
                  >
                    <Icon name="tune" size={17} />
                  </button>
                </div>

                <div className="composer-bar-right">
                  <motion.button
                    type="submit"
                    className="send-arrow-button"
                    disabled={!question.trim() || busy}
                    title="Send message"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Icon name="arrow-up" size={18} />
                  </motion.button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Right Inspector Panel matching Documind_workspace.png */}
        <AnimatePresence>
          {inspectorOpen && (
            <motion.aside
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="workspace-inspector"
            >
            {/* Inspector Tabs */}
            <div className="inspector-tabs-header">
              <div className="inspector-tabs-group">
                <button
                  className={`inspector-tab-btn ${activeTab === "sources" ? "active" : ""}`}
                  onClick={() => setActiveTab("sources")}
                >
                  Sources
                </button>
                <button
                  className={`inspector-tab-btn ${activeTab === "details" ? "active" : ""}`}
                  onClick={() => setActiveTab("details")}
                >
                  Details
                </button>
                <button
                  className={`inspector-tab-btn ${activeTab === "related" ? "active" : ""}`}
                  onClick={() => setActiveTab("related")}
                >
                  Related
                </button>
              </div>
              <button
                className="inspector-close-btn"
                onClick={() => setInspectorOpen(false)}
                title="Close panel"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Tab Contents */}
            <div className="inspector-tab-content">
              {activeTab === "sources" && (
                <div className="sources-list-wrap">
                  {allCitations.length > 0 ? (
                    allCitations.map((citation, idx) => {
                      const isSelected = activeCitation?.chunk_id === citation.chunk_id;
                      return (
                        <div
                          key={citation.chunk_id}
                          className={`source-card-mock ${isSelected ? "selected" : ""}`}
                          onClick={() => setActiveCitation(citation)}
                        >
                          <div className="source-card-header">
                            <div className="source-card-title-group">
                              <Icon name="file" size={15} className="text-blue-600" />
                              <span className="source-title-text truncate max-w-[140px]" title={citation.document_name}>
                                {citation.document_name || `Source ${idx + 1}`}
                              </span>
                              {citation.page_start != null ? (
                                <span className="source-page-badge">
                                  p. {citation.page_start}{citation.page_end && citation.page_end !== citation.page_start ? `–${citation.page_end}` : ""}
                                </span>
                              ) : (
                                <span className="source-page-badge">
                                  Chunk #{citation.chunk_index + 1}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              #{citation.chunk_index + 1}
                            </span>
                          </div>

                          <div className="source-card-body-row">
                            <div className="source-card-text-col">
                              {citation.section && (
                                <h4 className="source-section-heading">
                                  {citation.section}
                                </h4>
                              )}
                              <p className="source-excerpt-paragraph">{citation.quote}</p>
                            </div>

                            {/* Miniature Document Page Thumbnail */}
                            <div className="source-page-thumbnail">
                              <div className="thumbnail-paper">
                                <div className="thumb-line header-line" />
                                <div className="thumb-line full-line" />
                                <div className="thumb-line highlight-line" />
                                <div className="thumb-line highlight-line" />
                                <div className="thumb-line partial-line" />
                                <div className="thumb-line full-line" />
                                <div className="thumb-line full-line" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                        <Icon name="search" size={18} className="text-slate-500" />
                      </div>
                      <p className="text-sm font-medium text-white/70">No sources retrieved yet</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Ask a question and DocuMind will surface cited excerpts from your indexed documents here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "details" && (
                <div className="inspector-details-tab">
                  <div className="info-group">
                    <span className="info-label">File name</span>
                    <span className="info-value">{activeDoc?.filename ?? "-"}</span>
                  </div>
                  <div className="info-group">
                    <span className="info-label">File type</span>
                    <span className="info-value">{activeDoc?.mime_type === "application/pdf" ? "PDF" : "TXT"}</span>
                  </div>
                  <div className="info-group">
                    <span className="info-label">File size</span>
                    <span className="info-value">
                      {activeDoc ? `${(activeDoc.byte_size / (1024 * 1024)).toFixed(1)} MB` : "-"}
                    </span>
                  </div>
                  <div className="info-group">
                    <span className="info-label">Page count</span>
                    <span className="info-value">
                      {activeDoc?.page_count != null ? `${activeDoc.page_count} pages` : "N/A (Plain text)"}
                    </span>
                  </div>
                  <div className="info-group">
                    <span className="info-label">Embedding model</span>
                    <span className="info-value">{meta?.embedding_model ?? "text-embedding-3-small"}</span>
                  </div>
                  <div className="info-group">
                    <span className="info-label">Dimensions</span>
                    <span className="info-value">{meta?.embedding_dimensions ?? 1536}</span>
                  </div>
                  <Link
                    href={`/documents/${activeDoc?.document_id ?? ""}`}
                    className="view-full-doc-link"
                  >
                    Open Document Details →
                  </Link>
                </div>
              )}

              {activeTab === "related" && (
                <div className="inspector-related-tab">
                  <h4>Related Knowledge</h4>
                  {documents.filter((d) => d.status === "ready" && d.document_id !== activeDocId).length > 0 ? (
                    <ul className="related-items-list">
                      {documents
                        .filter((d) => d.status === "ready" && d.document_id !== activeDocId)
                        .slice(0, 5)
                        .map((doc) => (
                          <li key={doc.document_id}>
                            <Link
                              href={`/?document=${doc.document_id}`}
                              onClick={() => setActiveDocId(doc.document_id)}
                            >
                              {doc.filename}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">
                      {documents.length === 0
                        ? "Upload documents to see related knowledge here."
                        : "No other ready documents in workspace."}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>

    {/* Ticket Dialog Modal */}
    <AnimatePresence>
      {ticketModalOpen && (
        <TicketDialog
          meta={meta}
          onClose={() => setTicketModalOpen(false)}
          onSuccess={(ticketNumber) => {
            setMessages((curr) => {
              const updated = [
                ...curr,
                {
                  id: crypto.randomUUID(),
                  role: "assistant" as const,
                  text: `Support ticket **${ticketNumber}** has been confirmed and submitted to the queue. Our support specialists will respond shortly.`,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ];
              saveConversation(currentConvId, updated, {
                id: activeDoc?.document_id,
                name: activeDoc?.filename,
              });
              return updated;
            });
            setTicketModalOpen(false);
          }}
        />
      )}
    </AnimatePresence>
  </main>
);
}

function TicketDialog({
  meta,
  onClose,
  onSuccess,
}: {
  meta: AppMeta | null;
  onClose: () => void;
  onSuccess: (ticketNum: string) => void;
}) {
  const [draft, setDraft] = useState({ subject: "", description: "", order_number: "" });
  const [pending, setPending] = useState<PendingTicket | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handlePrepare = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await prepareTicket({
        ...draft,
        order_number: draft.order_number || undefined,
      });
      setPending(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare ticket.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const res = await confirmTicket(pending.pending_action_id);
      toast.success(`Support ticket ${res.ticket_number} created successfully.`);
      onSuccess(res.ticket_number);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to confirm ticket.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="ticket-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <span className="modal-kicker">Controlled Tool Action • {meta?.application_name || "DocuMind"}</span>
            <h3>{pending ? "Confirm Support Ticket" : "Create Support Ticket"}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {error && (
          <div className="modal-error-banner">
            <Icon name="alert-circle" size={16} />
            <span>{error}</span>
          </div>
        )}

        {!pending ? (
          <form onSubmit={handlePrepare} className="ticket-modal-form">
            <div className="form-field-group">
              <label>Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Return request for defective item"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>

            <div className="form-field-group">
              <label>Order Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. ORD-1001"
                value={draft.order_number}
                onChange={(e) => setDraft({ ...draft, order_number: e.target.value })}
              />
            </div>

            <div className="form-field-group">
              <label>Description</label>
              <textarea
                required
                rows={4}
                placeholder="Explain the issue with sufficient detail (at least 10 characters)..."
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>

            <div className="modal-footer-row">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Preparing..." : "Review Ticket"}
              </button>
            </div>
          </form>
        ) : (
          <div className="ticket-confirmation-view">
            <div className="confirmation-summary-card">
              <span className="summary-label">Proposed Action:</span>
              <p className="summary-text">{pending.summary}</p>
              <span className="expires-notice">
                Expires at {new Date(pending.expires_at).toLocaleTimeString()}
              </span>
            </div>

            <p className="guardrail-notice">
              In accordance with security guardrails, write actions require explicit user confirmation.
            </p>

            <div className="modal-footer-row">
              <button type="button" className="btn-secondary" onClick={() => setPending(null)}>
                Edit Details
              </button>
              <button type="button" className="btn-primary" onClick={handleConfirm} disabled={busy}>
                {busy ? "Confirming..." : "Confirm & Create Ticket"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
