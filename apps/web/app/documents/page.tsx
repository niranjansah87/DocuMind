"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { deleteDocument, getAppMeta, getDocument, listDocuments, uploadDocument } from "@/lib/api";
import type { AppMeta, DocumentDetail, DocumentItem } from "@/lib/types";

export interface ExtendedDocumentItem extends DocumentItem {
  description?: string;
  tokens?: number;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<ExtendedDocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [selectedDocDetail, setSelectedDocDetail] = useState<DocumentDetail | null>(null);
  const [filter, setFilter] = useState<"all" | "processing" | "completed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeDrawerTab, setActiveDrawerTab] = useState<"overview" | "chunks" | "preview">("overview");
  const [now] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const realDocs = await listDocuments();
      setDocuments(realDocs);
      if (realDocs.length > 0) {
        setSelectedDocId((curr) => {
          if (curr && realDocs.some((d) => d.document_id === curr)) return curr;
          return realDocs[0].document_id;
        });
      } else {
        setSelectedDocId("");
        setSelectedDocDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const realDocs = await listDocuments();
        if (!isMounted) return;
        setDocuments(realDocs);
        if (realDocs.length > 0) {
          setSelectedDocId(realDocs[0].document_id);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load documents.");
      }

      try {
        const metaInfo = await getAppMeta();
        if (isMounted) setMeta(metaInfo);
      } catch {
        // ignore
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    let isMounted = true;
    getDocument(selectedDocId)
      .then((detail) => {
        if (isMounted) setSelectedDocDetail(detail);
      })
      .catch(() => {
        if (isMounted) setSelectedDocDetail(null);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedDocId]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setNotice(`Uploading and indexing ${file.name}...`);
    try {
      const result = await uploadDocument(file);
      const msg = result.duplicate
        ? `${result.filename} was already indexed in this workspace.`
        : `${result.filename} indexed successfully with ${result.chunk_count} chunks.`;
      setNotice(msg);
      toast.success(msg);
      await refresh();
      setSelectedDocId(result.document_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      setNotice("");
      toast.error(msg);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`Delete ${doc.filename}?`)) return;
    try {
      await deleteDocument(doc.document_id);
      setDocuments((curr) => curr.filter((d) => d.document_id !== doc.document_id));
      const msg = `${doc.filename} deleted.`;
      setNotice(msg);
      toast.success(msg);
      if (selectedDocId === doc.document_id) {
        setSelectedDocId("");
        setSelectedDocDetail(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      setError(msg);
      toast.error(msg);
    }
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Filter by status
      if (filter === "processing" && doc.status !== "processing") return false;
      if (filter === "completed" && doc.status !== "ready") return false;
      if (filter === "failed" && doc.status !== "failed") return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return doc.filename.toLowerCase().includes(q);
      }
      return true;
    });
  }, [documents, filter, searchQuery]);

  const counts = useMemo(() => {
    const total = documents.length;
    const processing = documents.filter((d) => d.status === "processing").length;
    const completed = documents.filter((d) => d.status === "ready").length;
    const failed = documents.filter((d) => d.status === "failed").length;
    return { total, processing, completed, failed };
  }, [documents]);

  const selectedDoc = documents.find((d) => d.document_id === selectedDocId) || documents[0];

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatTimeAgo = (isoString: string) => {
    const diffMs = now - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <main className="documents-page-container">
      <div className="documents-main-column">
        {/* Top Banner matching documind_documents_page.png */}
        <section className="documents-top-banner">
          <div className="top-banner-icon-box">
            <Icon name="file" size={24} className="text-blue-600" />
          </div>
          <div className="top-banner-text">
            <h3>Upload documents to start a conversation</h3>
            <p>
              Supported formats: PDF, TXT • Max size: 20 MB
              {meta ? ` • Engine: ${meta.embedding_model}` : ""}
            </p>
          </div>
          <motion.button
            className="top-banner-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            <Icon name="cloud-upload" size={18} />
            <span>{uploading ? "Uploading..." : "Upload Document"}</span>
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            className="visually-hidden"
            accept=".pdf,.txt"
            onChange={handleUpload}
          />
        </section>

        {/* Notices */}
        {notice && (
          <div className="documents-notice-banner">
            <Icon name="check-circle" size={16} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        {error && (
          <div className="documents-error-banner">
            <Icon name="alert-circle" size={16} />
            <span className="flex-1">{error}</span>
            {(error.toLowerCase().includes("credential") ||
              error.toLowerCase().includes("unauthorized") ||
              error.toLowerCase().includes("forbidden") ||
              error.toLowerCase().includes("401") ||
              error.toLowerCase().includes("403")) && (
              <Link
                href="/login"
                className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors ml-2"
              >
                Authenticate →
              </Link>
            )}
            <button onClick={() => setError("")}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Page Heading */}
        <div className="documents-heading-section">
          <h1>Documents</h1>
          <p>Manage your documents, track processing status, and view details.</p>
        </div>

        {/* Filters and Search Bar */}
        <div className="documents-controls-row">
          <div className="filter-pills-group">
            <button
              className={`filter-pill-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              <span>All Documents</span>
              <span className="pill-counter">{counts.total}</span>
            </button>
            <button
              className={`filter-pill-btn ${filter === "processing" ? "active" : ""}`}
              onClick={() => setFilter("processing")}
            >
              <span>Processing</span>
              <span className="pill-counter">{counts.processing}</span>
            </button>
            <button
              className={`filter-pill-btn ${filter === "completed" ? "active" : ""}`}
              onClick={() => setFilter("completed")}
            >
              <span>Completed</span>
              <span className="pill-counter">{counts.completed}</span>
            </button>
            <button
              className={`filter-pill-btn ${filter === "failed" ? "active" : ""}`}
              onClick={() => setFilter("failed")}
            >
              <span>Failed</span>
              <span className="pill-counter">{counts.failed}</span>
            </button>
          </div>

          <div className="documents-search-box">
            <Icon name="search" size={16} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Documents Table */}
        <div className="documents-table-wrapper">
          <table className="documents-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input type="checkbox" aria-label="Select all documents" />
                </th>
                <th className="th-name">
                  <span>Name</span>
                  <Icon name="chevron-down" size={13} />
                </th>
                <th className="th-type">Type</th>
                <th className="th-size">Size</th>
                <th className="th-chunks">Chunks</th>
                <th className="th-status">Status</th>
                <th className="th-uploaded">
                  <span>Uploaded</span>
                  <Icon name="chevron-down" size={13} />
                </th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                        <Icon name="file" size={24} />
                      </div>
                      <h4 className="text-base font-semibold text-white">
                        {documents.length === 0 ? "No documents uploaded yet" : "No matching documents"}
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {documents.length === 0
                          ? "Upload a PDF or TXT document (up to 20 MB) to parse pages, generate embeddings, and query with grounded citations."
                          : "Try adjusting your search query or filter."}
                      </p>
                      {documents.length === 0 && (
                        <button
                          className="mt-2 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer inline-flex items-center gap-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Icon name="cloud-upload" size={14} />
                          <span>Upload First Document</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc, idx) => {
                  const isSelected = selectedDoc?.document_id === doc.document_id;
                  const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
                  const chunkCount = doc.page_count ? doc.page_count * 2 : 1;

                  return (
                    <motion.tr
                      key={doc.document_id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.3) }}
                      className={`document-table-row ${isSelected ? "selected-row" : ""}`}
                      onClick={() => setSelectedDocId(doc.document_id)}
                    >
                      <td className="td-checkbox" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${doc.filename}`} />
                      </td>
                      <td className="td-name">
                        <div className="td-doc-item">
                          <div className={`table-file-icon ${isPdf ? "pdf" : "txt"}`}>
                            <Icon name={isPdf ? "pdf" : "txt"} size={18} />
                          </div>
                          <div className="table-doc-info">
                            <span className="table-filename">{doc.filename}</span>
                            <span className="table-subtext">
                              {doc.description ?? "Document knowledge source"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="td-type">
                        <span className={`table-type-pill ${isPdf ? "pdf" : "txt"}`}>
                          {isPdf ? "PDF" : "TXT"}
                        </span>
                      </td>
                      <td className="td-size">{formatFileSize(doc.byte_size)}</td>
                      <td className="td-chunks">{doc.status === "failed" ? "—" : chunkCount}</td>
                      <td className="td-status">
                        <span className={`status-badge-cell ${doc.status === "ready" ? "completed" : doc.status}`}>
                          <span className="status-dot" />
                          <span>
                            {doc.status === "ready"
                              ? "Completed"
                              : doc.status === "processing"
                                ? "Processing"
                                : "Failed"}
                          </span>
                        </span>
                      </td>
                      <td className="td-uploaded">{formatTimeAgo(doc.created_at)}</td>
                      <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="action-row-buttons">
                          <button
                            className="table-action-dots-btn"
                            title="View options"
                            onClick={() => router.push(`/documents/${doc.document_id}`)}
                          >
                            <Icon name="more" size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="documents-pagination-bar">
            <div className="pagination-controls">
              <button className="pagination-nav-btn" disabled>
                <Icon name="chevron-left" size={15} />
              </button>
              <button className="pagination-page-btn active">1</button>
              <button className="pagination-nav-btn" disabled>
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
            <span className="pagination-summary">
              Showing 1-{filteredDocs.length} of {documents.length} documents
            </span>
          </div>
        </div>
      </div>

      {/* Right Slide-out Detail Drawer matching documind_documents_page.png */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.aside
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="documents-detail-drawer"
          >
          <div className="drawer-close-row">
            <button
              className="drawer-close-btn"
              title="Delete document"
              onClick={() => handleDelete(selectedDoc)}
              style={{ marginRight: 6 }}
            >
              <Icon name="trash" size={16} />
            </button>
            <button className="drawer-close-btn" onClick={() => setSelectedDocId("")}>
              <Icon name="close" size={16} />
            </button>
          </div>

          <div className="drawer-header-card">
            <div className={`drawer-doc-icon-large ${selectedDoc.filename.toLowerCase().endsWith(".pdf") ? "red" : "blue"}`}>
              <Icon name={selectedDoc.filename.toLowerCase().endsWith(".pdf") ? "pdf" : "txt"} size={32} />
            </div>
            <h3 className="drawer-doc-title">{selectedDoc.filename}</h3>
            <p className="drawer-doc-meta">
              {formatFileSize(selectedDoc.byte_size)} • {selectedDoc.filename.endsWith(".pdf") ? "PDF" : "TXT"} • Uploaded {formatTimeAgo(selectedDoc.created_at)}
            </p>

            <div className="drawer-status-summary-row">
              <span className={`drawer-status-badge ${selectedDoc.status === "ready" ? "completed" : selectedDoc.status}`}>
                {selectedDoc.status === "ready" ? "Completed" : selectedDoc.status === "processing" ? "Processing" : "Failed"}
              </span>
              <span className="drawer-chunks-stat">
                {selectedDocDetail?.chunk_count ?? (selectedDoc.page_count ? selectedDoc.page_count * 2 : 1)} chunks
                {selectedDocDetail?.chunks ? ` • ${selectedDocDetail.chunks.reduce((sum, c) => sum + (c.token_count || 0), 0)} tokens` : ""}
              </span>
            </div>
          </div>

          {/* Drawer Tabs */}
          <div className="drawer-tabs-row">
            <button
              className={`drawer-tab-btn ${activeDrawerTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveDrawerTab("overview")}
            >
              Overview
            </button>
            <button
              className={`drawer-tab-btn ${activeDrawerTab === "chunks" ? "active" : ""}`}
              onClick={() => setActiveDrawerTab("chunks")}
            >
              Chunks
            </button>
            <button
              className={`drawer-tab-btn ${activeDrawerTab === "preview" ? "active" : ""}`}
              onClick={() => setActiveDrawerTab("preview")}
            >
              Preview
            </button>
          </div>

          {/* Drawer Content */}
          <div className="drawer-content-scroll">
            {activeDrawerTab === "overview" && (
              <>
                <div className="drawer-section">
                  <h4 className="drawer-section-heading">Document Information</h4>
                  <div className="drawer-kv-list">
                    <div className="drawer-kv-row">
                      <span className="kv-label">File name</span>
                      <span className="kv-value">{selectedDoc.filename}</span>
                    </div>
                    <div className="drawer-kv-row">
                      <span className="kv-label">File type</span>
                      <span className="kv-value">{selectedDoc.filename.endsWith(".pdf") ? "PDF" : "TXT"}</span>
                    </div>
                    <div className="drawer-kv-row">
                      <span className="kv-label">File size</span>
                      <span className="kv-value">{formatFileSize(selectedDoc.byte_size)}</span>
                    </div>
                    <div className="drawer-kv-row">
                      <span className="kv-label">Upload date</span>
                      <span className="kv-value">
                        {new Date(selectedDoc.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="drawer-kv-row">
                      <span className="kv-label">Processed at</span>
                      <span className="kv-value">
                        {selectedDoc.status === "ready"
                          ? new Date(selectedDoc.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "In progress"}
                      </span>
                    </div>
                    <div className="drawer-kv-row">
                      <span className="kv-label">Total chunks</span>
                      <span className="kv-value">
                        {selectedDocDetail?.chunk_count ?? (selectedDoc.page_count ? selectedDoc.page_count * 2 : 1)}
                      </span>
                    </div>
                    <div className="drawer-kv-row">
                      <span className="kv-label">Total tokens</span>
                      <span className="kv-value">
                        {selectedDocDetail?.chunks
                          ? selectedDocDetail.chunks.reduce((sum, c) => sum + (c.token_count || 0), 0)
                          : "Indexed in database"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Processing Timeline */}
                <div className="drawer-section">
                  <h4 className="drawer-section-heading">Processing</h4>
                  <div className="drawer-timeline-list">
                    <div className="timeline-step done">
                      <Icon name="check-circle" size={17} className="timeline-icon green" />
                      <span className="timeline-text">File uploaded</span>
                      <span className="timeline-timestamp">Completed</span>
                    </div>
                    <div className="timeline-step done">
                      <Icon name="check-circle" size={17} className="timeline-icon green" />
                      <span className="timeline-text">Text extracted</span>
                      <span className="timeline-timestamp">Completed</span>
                    </div>
                    <div className="timeline-step done">
                      <Icon name="check-circle" size={17} className="timeline-icon green" />
                      <span className="timeline-text">Chunks created</span>
                      <span className="timeline-timestamp">Completed</span>
                    </div>
                    <div className="timeline-step done">
                      <Icon name="check-circle" size={17} className="timeline-icon green" />
                      <span className="timeline-text">Embeddings generated</span>
                      <span className="timeline-timestamp">Completed</span>
                    </div>
                    <div className="timeline-step done">
                      <Icon name="check-circle" size={17} className="timeline-icon green" />
                      <span className="timeline-text">Indexed in database</span>
                      <span className="timeline-timestamp">Completed</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeDrawerTab === "chunks" && (
              <div className="drawer-section">
                <h4 className="drawer-section-heading">Indexed Chunks</h4>
                {selectedDocDetail?.chunks && selectedDocDetail.chunks.length > 0 ? (
                  <>
                    <p className="drawer-subcopy">
                      Showing {Math.min(selectedDocDetail.chunks.length, 4)} of {selectedDocDetail.chunks.length} chunks indexed into pgvector:
                    </p>
                    <div className="drawer-chunk-snippets">
                      {selectedDocDetail.chunks.slice(0, 4).map((chunk) => (
                        <div key={chunk.chunk_id} className="drawer-snippet-card">
                          <strong>
                            Chunk {chunk.chunk_index + 1} • {chunk.section || `Page ${chunk.page_start ?? 1}`}
                          </strong>
                          <p>{chunk.text.slice(0, 220)}...</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="drawer-subcopy text-slate-400">
                    {selectedDoc.status === "ready"
                      ? "Loading chunk embeddings..."
                      : "Chunks will appear here once document indexing completes."}
                  </p>
                )}
              </div>
            )}

            {activeDrawerTab === "preview" && (
              <div className="drawer-section">
                <h4 className="drawer-section-heading">Document Preview</h4>
                <p className="drawer-subcopy">
                  Open the deep document viewer to inspect page thumbnails and highlighted excerpts.
                </p>
                <Link
                  href={`/documents/${selectedDoc.document_id}`}
                  className="open-full-viewer-btn"
                >
                  Open Full Viewer →
                </Link>
              </div>
            )}
          </div>

          {/* Drawer Bottom Actions */}
          <div className="drawer-bottom-actions">
            <button
              className="drawer-outline-chat-btn"
              onClick={() => router.push(`/?document=${selectedDoc.document_id}`)}
            >
              <Icon name="chat" size={16} />
              <span>Chat with this document</span>
            </button>
            <button
              className="drawer-solid-chat-btn"
              onClick={() => router.push(`/?document=${selectedDoc.document_id}`)}
            >
              <span>Ask in Chat →</span>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  </main>
);
}

