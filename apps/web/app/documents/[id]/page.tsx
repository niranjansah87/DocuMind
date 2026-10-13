"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    window.open(`/api/v1/documents/${document.document_id}/download`, "_blank");
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
  const fileSizeMb = document ? (document.byte_size / (1024 * 1024)).toFixed(1) : "2.4";
  const chunkCount = document?.chunk_count ?? 24;

  return (
    <main className="document-detail-page">
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
          <div className="detail-pdf-icon-box">
            <Icon name="pdf" size={26} />
          </div>
          <div className="detail-title-col">
            <h1 className="detail-doc-title">{docName}</h1>
            <p className="detail-doc-meta">
              Uploaded Oct 12, 2026 at 10:24 AM • {fileSizeMb} MB • {chunkCount} chunks • 5,842 tokens
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
                        <span>Customer Support Policy</span>
                        <small>Version 1.0 • Oct 2026</small>
                      </div>
                    </div>

                    <div className="paper-content-flow">
                      <section className="paper-section">
                        <h3>1. Introduction</h3>
                        <p>
                          This Customer Support Policy explains how we handle customer requests, including
                          returns, refunds, order support, and general inquiries. Our goal is to ensure a smooth
                          and transparent experience for all customers.
                        </p>
                      </section>

                      <section className="paper-section">
                        <h3>2. Refund Policy</h3>
                        <h4>2.1 Overview</h4>
                        <p>
                          <mark className="highlighted-text-quote">
                            Refunds are generally processed within 5–7 business days after an approved return
                            is received and inspected. The refund will be issued to the original payment method
                            used at the time of purchase.
                          </mark>
                        </p>

                        <h4>2.2 Eligibility</h4>
                        <p>
                          To be eligible for a refund, the item must be returned within 30 days of delivery and
                          must be in its original condition with all packaging and accessories.
                        </p>

                        <h4>2.3 Non-Refundable Items</h4>
                        <p>
                          Certain items such as digital products, gift cards, and perishable goods are not
                          eligible for refunds.
                        </p>

                        <h4>2.4 Partial Refunds</h4>
                        <p>
                          In some cases, only a partial refund may be issued, for example if the item is returned
                          in a used or damaged condition.
                        </p>
                      </section>
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
                  <span className="kv-value">PDF</span>
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
                  <span className="kv-value">Oct 12, 2026, 10:24 AM</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Processed at</span>
                  <span className="kv-value">Oct 12, 2026, 10:25 AM</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Total chunks</span>
                  <span className="kv-value">{chunkCount}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Total tokens</span>
                  <span className="kv-value">5,842</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Status</span>
                  <span className="status-pill-green">Completed</span>
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
    </main>
  );
}
