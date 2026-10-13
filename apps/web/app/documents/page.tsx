"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { deleteDocument, getAppMeta, listDocuments, uploadDocument } from "@/lib/api";
import type { AppMeta, DocumentItem } from "@/lib/types";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    setDocuments(await listDocuments());
  }
  useEffect(() => {
    Promise.all([listDocuments(), getAppMeta()])
      .then(([items, appMeta]) => { setDocuments(items); setMeta(appMeta); })
      .catch(() => setError("Could not load documents."));
  }, []);
  const filtered = useMemo(
    () =>
      documents.filter((document) =>
        document.filename.toLowerCase().includes(query.toLowerCase()),
      ),
    [documents, query],
  );

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setNotice(`Processing ${file.name}…`);
    try {
      const result = await uploadDocument(file);
      setNotice(
        result.duplicate
          ? `${result.filename} was already in this workspace.`
          : `${result.filename} is ready with ${result.chunk_count} chunks.`,
      );
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
      setNotice("");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function remove(document: DocumentItem) {
    if (
      !window.confirm(
        `Delete ${document.filename}? Its stored chunks and vectors will also be removed.`,
      )
    )
      return;
    try {
      await deleteDocument(document.document_id);
      setDocuments((items) =>
        items.filter((item) => item.document_id !== document.document_id),
      );
      setNotice(`${document.filename} deleted.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delete failed.");
    }
  }

  return (
    <main className="documents-page">
      <header className="topbar">
        <div>
          <span className="crumb">Library</span>
          <h1>Documents</h1>
        </div>
        <button onClick={() => fileInput.current?.click()} disabled={uploading}>
          <Icon name="upload" /> {uploading ? "Processing…" : "Upload document"}
        </button>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept={meta?.accepted_extensions.map((extension) => `.${extension.toLowerCase()}`).join(",")}
          onChange={(event) => void upload(event)}
        />
      </header>
      <section
        className="upload-banner"
        onClick={() => fileInput.current?.click()}
      >
        <div className="upload-art">
          <Icon name="upload" size={27} />
        </div>
        <div>
          <span className="eyebrow">Build your knowledge base</span>
          <h2>Upload a {meta?.accepted_extensions.join(" or ") ?? "document"}</h2>
          <p>
            Files are validated, chunked, embedded, and stored before they
            become available to chat.
          </p>
        </div>
        <span className="upload-limit">
          {meta?.accepted_extensions.join(" · ")}
          <br />
          <strong>{meta ? `${formatBytes(meta.max_upload_bytes)} max` : ""}</strong>
        </span>
      </section>
      {notice && (
        <div className="notice-banner" role="status">
          <Icon name="check" />
          {notice}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <section className="document-library">
        <div className="library-toolbar">
          <div>
            <span className="eyebrow">Workspace library</span>
            <h2>
              All documents <span>{documents.length}</span>
            </h2>
          </div>
          <label className="search-box">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents"
              aria-label="Search documents"
            />
          </label>
        </div>
        <div className="document-table" role="table" aria-label="Documents">
          <div className="table-row table-head" role="row">
            <span>Name</span>
            <span>Status</span>
            <span>Size</span>
            <span>Uploaded</span>
            <span aria-label="Actions" />
          </div>
          {filtered.map((document) => (
            <div className="table-row" role="row" key={document.document_id}>
              <Link
                className="document-name"
                href={`/documents/${document.document_id}`}
              >
                <span
                  className={`file-tile ${document.filename.toLowerCase().endsWith(".pdf") ? "pdf" : "txt"}`}
                >
                  <Icon name="file" />
                </span>
                <span>
                  <strong>{document.filename}</strong>
                  <small>{document.mime_type}</small>
                </span>
              </Link>
              <span>
                <i className={`status-dot ${document.status}`} />
                {document.status}
              </span>
              <span>{formatBytes(document.byte_size)}</span>
              <span>{new Date(document.created_at).toLocaleDateString()}</span>
              <span className="row-actions">
                <Link href={`/documents/${document.document_id}`}>View</Link>
                <button
                  onClick={() => void remove(document)}
                  aria-label={`Delete ${document.filename}`}
                >
                  <Icon name="trash" />
                </button>
              </span>
            </div>
          ))}
          {!filtered.length && (
            <div className="table-empty">
              <Icon name="documents" size={27} />
              <h3>
                {documents.length
                  ? "No matching documents"
                  : "Your library is empty"}
              </h3>
              <p>
                {documents.length
                  ? "Try a different search."
                  : `Upload a ${meta?.accepted_extensions.join(" or ") ?? "supported"} file to start asking grounded questions.`}
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
