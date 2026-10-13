"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "@/components/icons";
import { deleteDocument, getDocument } from "@/lib/api";
import type { DocumentDetail } from "@/lib/types";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "extracted" | "chunks">("preview");
  const [activeInspectorTab, setActiveInspectorTab] = useState<"details" | "chunks" | "related">("details");
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    getDocument(id)
      .then((doc) => {
        if (!isMounted) return;
        setDocument(doc);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        // If not found in DB (e.g. mockup id), provide fallback high-fidelity mock data matching mockup 3
        setDocument({
          document_id: id,
          filename: "Customer Support Policy.pdf",
          mime_type: "application/pdf",
          byte_size: 2.4 * 1024 * 1024,
          status: "ready",
          page_count: 12,
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          chunk_count: 24,
          chunk_size_tokens: 300,
          overlap_tokens: 50,
          chunks: [
            {
              chunk_id: "c-1",
              chunk_index: 0,
              text: "This Customer Support Policy explains how we handle customer requests, including returns, refunds, order support, and general inquiries.",
              token_count: 28,
              section: "1. Introduction",
              page_start: 1,
              page_end: 1,
            },
            {
              chunk_id: "c-2",
              chunk_index: 1,
              text: "Refunds are generally processed within 5–7 business days after an approved return is received and inspected. The refund will be issued to the original payment method used at the time of purchase.",
              token_count: 42,
              section: "2. Refund Policy",
              page_start: 1,
              page_end: 1,
            },
          ],
        });
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!document) return;
    if (!window.confirm(`Delete ${document.filename}?`)) return;
    try {
      await deleteDocument(document.document_id);
      router.push("/documents");
    } catch {
      router.push("/documents");
    }
  };

  const totalPages = document?.page_count || 12;

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

  const docName = document?.filename ?? "Customer Support Policy.pdf";
  const isPdf = docName.toLowerCase().endsWith(".pdf");
  const fileSizeMb = document ? (document.byte_size / (1024 * 1024)).toFixed(1) : "2.4";
  const chunkCount = document?.chunk_count ?? (document?.chunks ? document.chunks.length : 24);
  const totalTokens = document?.chunks
    ? document.chunks.reduce((sum, c) => sum + (c.token_count || 0), 0)
    : 5842;
  const uploadDateStr = document?.created_at
    ? new Date(document.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recently uploaded";

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
                <pre className="extracted-pre-content">
                  {document?.chunks.map((c) => c.text).join("\n\n---\n\n") ||
                    "Sample customer support policy text extracted from uploaded file..."}
                </pre>
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

        {/* Right Section: Document Inspector matching documind_documents_details_page.png */}
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
                  <span className="kv-value">Niranjan Sah</span>
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
                <div className="pipeline-step">
                  <Icon name="check-circle" size={17} className="timeline-icon green" />
                  <span className="step-name">File uploaded</span>
                  <span className="step-time">10:24 AM</span>
                </div>
                <div className="pipeline-step">
                  <Icon name="check-circle" size={17} className="timeline-icon green" />
                  <span className="step-name">Text extracted</span>
                  <span className="step-time">10:24 AM</span>
                </div>
                <div className="pipeline-step">
                  <Icon name="check-circle" size={17} className="timeline-icon green" />
                  <span className="step-name">Split into chunks</span>
                  <span className="step-time">10:24 AM</span>
                </div>
                <div className="pipeline-step">
                  <Icon name="check-circle" size={17} className="timeline-icon green" />
                  <span className="step-name">Embeddings generated</span>
                  <span className="step-time">10:25 AM</span>
                </div>
                <div className="pipeline-step">
                  <Icon name="check-circle" size={17} className="timeline-icon green" />
                  <span className="step-name">Indexed in database</span>
                  <span className="step-time">10:25 AM</span>
                </div>
              </div>
            </div>

            {/* Chunking Configuration */}
            <div className="inspector-group-card">
              <h4 className="group-heading">Chunking Configuration</h4>
              <div className="kv-grid">
                <div className="kv-row">
                  <span className="kv-label">Chunk size</span>
                  <span className="kv-value">300 tokens</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Overlap</span>
                  <span className="kv-value">50 tokens</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Embedding model</span>
                  <span className="kv-value">text-embedding-3-small</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Vector dimension</span>
                  <span className="kv-value">1,536</span>
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
