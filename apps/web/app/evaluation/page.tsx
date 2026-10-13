const questions = [
  ["Q01", "Return window", "Returns and Refunds"],
  ["Q02", "Non-returnable items", "Returns and Refunds"],
  ["Q03", "Refund timing", "Returns and Refunds"],
  ["Q04", "Damaged item report", "Damaged or Incorrect Items"],
  ["Q05", "Domestic delivery", "Shipping and Delivery"],
  ["Q06", "First carrier scan", "Shipping and Delivery"],
  ["Q07", "Wrong address", "Shipping and Delivery"],
  ["Q08", "Contact support", "Contact and Support"],
  ["Q09", "Billing evidence", "Billing and Payments"],
  ["Q10", "Payment methods", "Billing and Payments"],
  ["Q11", "One-time passwords", "Account and Security"],
  ["Q12", "Unauthorized access", "Account and Security"],
  ["Q13", "Warranty period", "Warranty"],
  ["Q14", "Liquid damage", "Warranty"],
  ["Q15", "Missing parcel", "Missing Parcels"],
];

export default function EvaluationPage() {
  return (
    <main className="evaluation-page">
      <header className="topbar">
        <div>
          <span className="crumb">Quality</span>
          <h1>Retrieval Evaluation</h1>
        </div>
        <span className="provisional-badge">Results pending verified run</span>
      </header>
      <section className="evaluation-hero">
        <div>
          <span className="eyebrow">15-question gold set</span>
          <h2>Measure evidence, not confidence.</h2>
          <p>
            The evaluation compares 300- and 800-token chunks across vector and
            hybrid retrieval. No score is shown until a real provider and
            PostgreSQL run produces it.
          </p>
        </div>
        <div className="eval-config">
          <span>Dataset</span>
          <strong>sample_knowledge_document.md</strong>
          <span>Embedding</span>
          <strong>text-embedding-3-small · 1536d</strong>
          <span>Fusion</span>
          <strong>PostgreSQL FTS + pgvector RRF</strong>
        </div>
      </section>
      <div className="metric-grid">
        {[
          [
            "Evidence recall@5",
            "Pending",
            "Target evidence in retrieved chunks",
          ],
          ["Grounded answers", "Pending", "Claims supported by context"],
          ["Citation validity", "Pending", "Citations resolve to candidates"],
          ["Mean latency", "Pending", "Provider time included"],
        ].map(([label, value, note]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
            <div className="metric-placeholder" />
          </article>
        ))}
      </div>
      <div className="evaluation-grid">
        <section className="eval-table">
          <div className="library-toolbar">
            <div>
              <span className="eyebrow">Evaluation set</span>
              <h2>Gold questions</h2>
            </div>
            <span className="count">15</span>
          </div>
          <div className="eval-rows">
            <div className="eval-row head">
              <span>ID</span>
              <span>Question</span>
              <span>Gold section</span>
              <span>Status</span>
            </div>
            {questions.map(([id, question, section]) => (
              <div className="eval-row" key={id}>
                <strong>{id}</strong>
                <span>{question}</span>
                <span>{section}</span>
                <span className="pending-status">Pending</span>
              </div>
            ))}
          </div>
        </section>
        <aside className="evaluation-notes">
          <span className="eyebrow">Interpretation</span>
          <h2>What counts as a pass?</h2>
          <ol>
            <li>
              <span>1</span>
              <p>
                <strong>Correct evidence</strong>At least one top-k chunk
                contains the target section’s answer.
              </p>
            </li>
            <li>
              <span>2</span>
              <p>
                <strong>Supported answer</strong>Every material claim is
                entailed by retrieved context.
              </p>
            </li>
            <li>
              <span>3</span>
              <p>
                <strong>Valid citation</strong>Every returned chunk ID belongs
                to the authorized candidate set.
              </p>
            </li>
          </ol>
          <div className="run-note">
            <strong>Reproducible command</strong>
            <code>python -m app.evaluation --chunk-sizes 300 800</code>
            <p>
              Run from <code>apps/api</code> with the configured database and
              provider available.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
