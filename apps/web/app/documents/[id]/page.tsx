"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { getDocument } from "@/lib/api";
import type { DocumentDetail } from "@/lib/types";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [activeChunk, setActiveChunk] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    getDocument(id)
      .then(setDocument)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Could not load document.",
        ),
      );
  }, [id]);
  if (error)
    return (
      <main className="detail-page">
        <header className="topbar">
          <div>
            <span className="crumb">Documents / Error</span>
            <h1>Document unavailable</h1>
          </div>
        </header>
        <div className="error-banner">{error}</div>
      </main>
    );
  if (!document)
    return (
      <main className="detail-page">
        <div className="page-loading">
          <span className="spinner" />
          Loading document…
        </div>
      </main>
    );
  return (
    <main className="detail-page">
      <header className="topbar">
        <div>
          <span className="crumb">
            <Link href="/documents">Documents</Link> / Detail
          </span>
          <h1>{document.filename}</h1>
        </div>
        <Link
          className="secondary-button"
          href={`/?document=${document.document_id}`}
        >
          Ask this document →
        </Link>
      </header>
      <div className="detail-grid">
        <section className="document-preview">
          <div className="preview-toolbar">
            <div>
              <button className="active">Extracted text</button>
              <button disabled>Original preview</button>
            </div>
            <span>{document.chunk_count} chunks</span>
          </div>
          <div className="paper-preview">
            <div className="paper-heading">
              <span className="file-tile">
                <Icon name="file" />
              </span>
              <div>
                <span className="eyebrow">Stored source</span>
                <h2>{document.filename}</h2>
              </div>
            </div>
            {document.chunks.map((chunk) => (
              <article
                key={chunk.chunk_id}
                id={`chunk-${chunk.chunk_index}`}
                className={activeChunk === chunk.chunk_index ? "active" : ""}
                onClick={() => setActiveChunk(chunk.chunk_index)}
              >
                <small>
                  Chunk {chunk.chunk_index + 1}
                  {chunk.page_start ? ` · Page ${chunk.page_start}` : ""}
                </small>
                {chunk.section && <h3>{chunk.section}</h3>}
                <p>{chunk.text}</p>
              </article>
            ))}
          </div>
        </section>
        <aside className="document-inspector">
          <div>
            <span className="eyebrow">Document information</span>
            <h2>Details</h2>
          </div>
          <dl>
            <dt>Status</dt>
            <dd>
              <i className="status-dot ready" />
              {document.status}
            </dd>
            <dt>Type</dt>
            <dd>{document.mime_type}</dd>
            <dt>File size</dt>
            <dd>{formatBytes(document.byte_size)}</dd>
            <dt>Pages</dt>
            <dd>{document.page_count ?? "Not applicable"}</dd>
            <dt>Uploaded</dt>
            <dd>{new Date(document.created_at).toLocaleString()}</dd>
          </dl>
          <div className="pipeline">
            <span className="eyebrow">Ingestion pipeline</span>
            {[
              "Validated",
              "Text extracted",
              "Chunked",
              "Embedded",
              "Ready for retrieval",
            ].map((step) => (
              <div key={step}>
                <span>
                  <Icon name="check" size={13} />
                </span>
                {step}
              </div>
            ))}
          </div>
          <div className="chunk-settings">
            <span className="eyebrow">Chunk configuration</span>
            <div>
              <strong>{document.chunk_size_tokens ?? "—"}</strong>
              <small>target tokens</small>
            </div>
            <div>
              <strong>{document.overlap_tokens ?? "—"}</strong>
              <small>overlap tokens</small>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
