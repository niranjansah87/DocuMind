"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { deleteDocument, getAppMeta, getDocument } from "@/lib/api";
import type { AppMeta, DocumentDetail } from "@/lib/types";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "extracted" | "chunks">("preview");
  const [activeInspectorTab, setActiveInspectorTab] = useState<"details" | "chunks" | "related">("details");
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    Promise.all([getDocument(id), getAppMeta()])
      .then(([doc, appMeta]) => {
        if (!isMounted) return;
        setDocument(doc);
        setMeta(appMeta);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Document not found.");
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!document) return;
    if (!window.confirm(`Delete "${document.filename}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(document.document_id);
      toast.success(`"${document.filename}" deleted successfully.`);
      router.push("/documents");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const totalPages = document?.page_count || 1;

  const handleDownload = () => {
    if (!document) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    window.open(`${baseUrl}/api/v1/documents/${document.document_id}/download`, "_blank");
  };

  if (loading) {
    return (
      <main className="document-detail-page">
        <div className="page-loading-spinner">
          <span className="spinner-icon" />
          <span>Loading document details...</span>
        </div>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="document-detail-page flex flex-col items-center justify-center p-8 min-h-[500px]">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-[#0D121F] border border-white/10 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <Icon name="alert-circle" size={24} />
          </div>
          <h2 className="text-lg font-semibold text-white">Document Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || "The requested document could not be found or is not available in this workspace."}
          </p>
          <div className="pt-2">
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all"
            >
              <Icon name="chevron-left" size={14} />
              <span>Back to Documents</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const docName = document.filename;
  const isPdf = docName.toLowerCase().endsWith(".pdf");
  const fileSizeMb = (document.byte_size / (1024 * 1024)).toFixed(1);
  const chunkCount = document.chunk_count ?? (document.chunks ? document.chunks.length : 0);
  const totalTokens = document.chunks
    ? document.chunks.reduce((sum, c) => sum + (c.token_count || 0), 0)
    : 0;
  const uploadDateStr = new Date(document.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="document-detail-page"
    >
      {/* Breadcrumb row */}
      <div className="detail-breadcrumb-row">
        <Link href="/documents" className="breadcrumb-link">
          Documents
        </Link>
        <span className="breadcrumb-separator">&gt;</span>
        <span className="breadcrumb-current">{docName}</span>
      </div>

      {/* Top Document Header Bar */}
      <header className="detail-header-bar">
        <div className="detail-header-left">
          <div className={`detail-pdf-icon-box ${isPdf ? "" : "txt-doc"}`}>
            <Icon name={isPdf ? "pdf" : "txt"} size={26} />
          </div>
          <div className="detail-title-col">
            <h1 className="detail-doc-title">{docName}</h1>
            <p className="detail-doc-meta">
              Uploaded {uploadDateStr} • {fileSizeMb} MB • {chunkCount} chunks • {totalTokens.toLocaleString()} tokens
            </p>
          </div>
        </div>

        <div className="detail-header-actions">
          <button
            className="detail-action-btn outline"
            onClick={() => router.push(`/?document=${document?.document_id}`)}
          >
            <Icon name="chat" size={15} />
            <span>Open in Chat</span>
          </button>
          <button className="detail-action-btn outline" onClick={handleDownload}>
            <Icon name="download" size={15} />
            <span>Download</span>
          </button>
          <button className="detail-action-btn outline danger" onClick={handleDelete}>
            <Icon name="trash" size={15} />
            <span>Delete</span>
          </button>
          <button className="detail-icon-btn outline" title="More options">
            <Icon name="more" size={16} />
          </button>
        </div>
      </header>

      {/* Main Split Grid: Viewer on Left, Inspector on Right */}
      <div className="detail-body-split">
        {/* Left Section: Document Viewer */}
        <section className="detail-viewer-pane">
          {/* Viewer Tabs */}
          <div className="viewer-tabs-bar">
            <div className="viewer-tabs-group">
              <button
                className={`viewer-tab-btn ${activeTab === "preview" ? "active" : ""}`}
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </button>
              <button
                className={`viewer-tab-btn ${activeTab === "extracted" ? "active" : ""}`}
                onClick={() => setActiveTab("extracted")}
              >
                Extracted Text
              </button>
              <button
                className={`viewer-tab-btn ${activeTab === "chunks" ? "active" : ""}`}
                onClick={() => setActiveTab("chunks")}
              >
                Chunks
              </button>
            </div>
          </div>

          {/* Viewer Toolbar */}
          <div className="viewer-controls-toolbar">
            <div className="toolbar-page-selector">
              <button
                className="toolbar-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <Icon name="chevron-left" size={14} />
              </button>
              <span className="page-num-pill">{currentPage}</span>
              <span className="page-total-label">/ {totalPages}</span>
              <button
                className="toolbar-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <Icon name="chevron-right" size={14} />
              </button>
            </div>

            <div className="toolbar-zoom-group">
              <button
                className="toolbar-btn"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                title="Zoom out"
              >
                <Icon name="zoom-out" size={15} />
              </button>
              <span className="zoom-level-label">{zoomLevel}%</span>
              <button
                className="toolbar-btn"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                title="Zoom in"
              >
                <Icon name="zoom-in" size={15} />
              </button>
            </div>

            <div className="toolbar-actions-right">
              <button className="toolbar-btn" title="Fit to width">
                <Icon name="expand" size={15} />
              </button>
              <button className="toolbar-btn" title="Fullscreen">
                <Icon name="maximize" size={15} />
              </button>
              <button className="toolbar-btn" title="Search document">
                <Icon name="search" size={15} />
              </button>
            </div>
          </div>

          {/* Two-pane Viewer: Thumbnails rail on left, Sheet on right */}
          <div className="viewer-content-container">
            {activeTab === "preview" && (
              <div className="paper-viewer-split">
                {/* Thumbnails strip */}
                <div className="thumbnails-rail">
                  {Array.from({ length: Math.min(4, totalPages) }, (_, i) => i + 1).map((pNum) => (
                    <div
                      key={pNum}
                      className={`thumbnail-card ${currentPage === pNum ? "selected" : ""}`}
                      onClick={() => setCurrentPage(pNum)}
                    >
                      <div className="thumbnail-sheet">
                        <div className="thumb-tiny-line" />
                        <div className="thumb-tiny-line w-80" />
                        <div className="thumb-tiny-line w-60" />
                        <div className="thumb-tiny-line" />
                        <div className="thumb-tiny-line w-90" />
                      </div>
                      <span className="thumb-page-label">{pNum}</span>
                    </div>
                  ))}
                </div>

                {/* Rendered Document Paper Sheet matching documind_documents_details_page.png */}
                <div className="rendered-paper-stage">
                  <div
                    className="rendered-paper-sheet"
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
                  >
                    <div className="paper-header-row">
                      <h2 className="paper-brand-title">DocuMind</h2>
                      <div className="paper-header-right">
                        <span>{docName}</span>
                        <small>
                          {isPdf ? "PDF Document" : "Text Document"} • Page {currentPage} of {totalPages}
                        </small>
                      </div>
                    </div>

                    <div className="paper-content-flow">
                      {document?.chunks && document.chunks.length > 0 ? (
                        document.chunks
                          .filter((c) => !c.page_start || c.page_start === currentPage || totalPages === 1)
                          .map((chunk, idx) => (
                            <section key={chunk.chunk_id || idx} className="paper-section">
                              <h3>{chunk.section || `Chunk ${chunk.chunk_index + 1}`}</h3>
                              <p>
                                {idx === 0 ? (
                                  <mark className="highlighted-text-quote">{chunk.text}</mark>
                                ) : (
                                  chunk.text
                                )}
                              </p>
                            </section>
                          ))
                      ) : (
                        <section className="paper-section">
                          <h3>1. Document Preview</h3>
                          <p>
                            {document?.status === "processing"
                              ? "Document is currently being processed and chunked..."
                              : "No extracted chunks available for this document."}
                          </p>
                        </section>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "extracted" && (
              <div className="extracted-text-view">
                {document?.chunks && document.chunks.length > 0 ? (
                  <pre className="extracted-pre-content">
                    {document.chunks.map((c) => c.text).join("\n\n---\n\n")}
                  </pre>
                ) : (
                  <div className="viewer-empty-state">
                    <Icon name="file" size={24} />
                    <p>No extracted text available for this document.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "chunks" && (
              <div className="chunks-list-view">
                {document?.chunks.map((chunk) => (
                  <div key={chunk.chunk_id} className="chunk-inspector-card">
                    <div className="chunk-card-meta">
                      <strong>Chunk {chunk.chunk_index + 1}</strong>
                      <span>{chunk.token_count} tokens</span>
                      {chunk.page_start && <span>Page {chunk.page_start}</span>}
                    </div>
                    {chunk.section && <div className="chunk-section-title">{chunk.section}</div>}
                    <p className="chunk-text-quote">{chunk.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Section: Document Inspector */}
        <aside className="detail-inspector-pane">
          {/* Tabs */}
          <div className="inspector-tabs-row">
            <button
              className={`inspector-tab-btn ${activeInspectorTab === "details" ? "active" : ""}`}
              onClick={() => setActiveInspectorTab("details")}
            >
              Details
            </button>
            <button
              className={`inspector-tab-btn ${activeInspectorTab === "chunks" ? "active" : ""}`}
              onClick={() => setActiveInspectorTab("chunks")}
            >
              Chunks
            </button>
            <button
              className={`inspector-tab-btn ${activeInspectorTab === "related" ? "active" : ""}`}
              onClick={() => setActiveInspectorTab("related")}
            >
              Related
            </button>
          </div>

          <div className="detail-inspector-scroll">
            {/* Document Information */}
            <div className="inspector-group-card">
              <h4 className="group-heading">Document Information</h4>
              <div className="kv-grid">
                <div className="kv-row">
                  <span className="kv-label">File name</span>
                  <span className="kv-value">{docName}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">File type</span>
                  <span className="kv-value">{isPdf ? "PDF" : "TXT"}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">File size</span>
                  <span className="kv-value">{fileSizeMb} MB</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Uploaded by</span>
                  <span className="kv-value">{meta?.scope_label ?? meta?.workspace_name ?? "Workspace"}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Upload date</span>
                  <span className="kv-value">{uploadDateStr}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Processed at</span>
                  <span className="kv-value">{uploadDateStr}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Total chunks</span>
                  <span className="kv-value">{chunkCount}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Total tokens</span>
                  <span className="kv-value">{totalTokens.toLocaleString()}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Status</span>
                  <span className={`status-pill-${document?.status === "ready" ? "green" : "blue"}`}>
                    {document?.status === "ready" ? "Completed" : document?.status === "processing" ? "Processing" : "Failed"}
                  </span>
                </div>
              </div>
            </div>

            {/* Processing Pipeline */}
            <div className="inspector-group-card">
              <h4 className="group-heading">Processing Pipeline</h4>
              <div className="pipeline-timeline">
                {[
                  { label: "File uploaded", done: true },
                  { label: "Text extracted", done: document?.status !== "processing" },
                  { label: "Split into chunks", done: document?.status === "ready" || document?.status === "failed" },
                  { label: "Embeddings generated", done: document?.status === "ready" },
                  { label: "Indexed in database", done: document?.status === "ready" },
                ].map((step) => (
                  <div className="pipeline-step" key={step.label}>
                    <Icon
                      name={step.done ? "check-circle" : "alert-circle"}
                      size={17}
                      className={`timeline-icon ${step.done ? "green" : "muted"}`}
                    />
                    <span className="step-name">{step.label}</span>
                    <span className="step-time">
                      {step.done ? uploadDateStr : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chunking Configuration — from live AppMeta */}
            <div className="inspector-group-card">
              <h4 className="group-heading">Chunking Configuration</h4>
              <div className="kv-grid">
                <div className="kv-row">
                  <span className="kv-label">Chunk size</span>
                  <span className="kv-value">
                    {document?.chunk_size_tokens ?? meta?.chunk_size_tokens ?? "—"} tokens
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Overlap</span>
                  <span className="kv-value">
                    {document?.overlap_tokens ?? meta?.chunk_overlap_tokens ?? "—"} tokens
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Embedding model</span>
                  <span className="kv-value">{meta?.embedding_model ?? "—"}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Vector dimension</span>
                  <span className="kv-value">
                    {meta?.embedding_dimensions != null
                      ? meta.embedding_dimensions.toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom action button */}
            <button
              className="chat-with-doc-full-btn"
              onClick={() => router.push(`/?document=${document?.document_id}`)}
            >
              <Icon name="chat" size={16} />
              <span>Chat with this document</span>
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </aside>
      </div>
    </motion.main>
  );
}
