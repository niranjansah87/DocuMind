"use client";

import { useEffect, useState } from "react";
import { getEvaluation } from "@/lib/api";
import type { EvaluationData } from "@/lib/types";

export default function EvaluationPage() {
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getEvaluation().then(setEvaluation).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load evaluation data.")); }, []);
  const latest = evaluation?.runs.at(-1);
  const metric = (key: string) => latest?.[key] === undefined ? "Pending" : String(latest[key]);

  return <main className="evaluation-page">
    <header className="topbar"><div><span className="crumb">Quality</span><h1>Retrieval Evaluation</h1></div><span className="provisional-badge">{evaluation?.status ?? "Loading"}</span></header>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <section className="evaluation-hero"><div><span className="eyebrow">{evaluation ? `${evaluation.questions.length}-question gold set` : "Evaluation set"}</span><h2>Measure evidence, not confidence.</h2><p>The backend-defined evaluation compares configured chunk sizes across vector and hybrid retrieval. Results remain pending until a real database and provider run produces them.</p></div><div className="eval-config"><span>Dataset</span><strong>{evaluation?.dataset ?? "—"}</strong><span>Embedding</span><strong>{evaluation ? `${evaluation.embedding_model} · ${evaluation.embedding_dimensions}d` : "—"}</strong><span>Fusion</span><strong>{evaluation?.retrieval_strategy ?? "—"}</strong><span>Chunk sizes</span><strong>{evaluation?.chunk_sizes.join(" / ") ?? "—"}</strong></div></section>
    <div className="metric-grid">{[["Evidence recall@k", metric("retrieval_recall_at_k"), "Target evidence in retrieved chunks"], ["Grounded answers", metric("supported_answers"), "Claims supported by context"], ["Citation validity", metric("citation_validity"), "Citations resolve to candidates"], ["Mean latency", metric("mean_latency_ms"), "Provider time included"]].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small><div className="metric-placeholder" /></article>)}</div>
    <div className="evaluation-grid"><section className="eval-table"><div className="library-toolbar"><div><span className="eyebrow">Evaluation set</span><h2>Gold questions</h2></div><span className="count">{evaluation?.questions.length ?? 0}</span></div><div className="eval-rows"><div className="eval-row head"><span>ID</span><span>Question</span><span>Gold section</span><span>Status</span></div>{evaluation?.questions.map((item) => <div className="eval-row" key={item.id}><strong>{item.id}</strong><span>{item.question}</span><span>{item.gold_section}</span><span className="pending-status">{latest ? "Measured" : "Pending"}</span></div>)}</div></section><aside className="evaluation-notes"><span className="eyebrow">Interpretation</span><h2>What counts as a pass?</h2><ol><li><span>1</span><p><strong>Correct evidence</strong>At least one top-k chunk contains the target section’s answer.</p></li><li><span>2</span><p><strong>Supported answer</strong>Every material claim is entailed by retrieved context.</p></li><li><span>3</span><p><strong>Valid citation</strong>Every returned chunk ID belongs to the authorized candidate set.</p></li></ol><div className="run-note"><strong>Reproducible command</strong><code>{evaluation?.command ?? "Loading…"}</code><p>Run from <code>apps/api</code> with the configured database and provider available.</p></div></aside></div>
  </main>;
}
