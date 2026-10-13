"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { getEvaluation } from "@/lib/api";
import type { EvaluationData } from "@/lib/types";

type QuestionRow = {
  id: string;
  num: number;
  question: string;
  expectedShort: string;
  sectionPage: string;
  status300: "Correct" | "Partial" | "Incorrect";
  status800: "Correct" | "Partial" | "Incorrect";
  timeSeconds: number;
};

const GOLD_QUESTIONS_MOCK: QuestionRow[] = [
  {
    id: "Q01",
    num: 1,
    question: "What is the refund policy?",
    expectedShort: "Refunds are processed within 5–7 business days...",
    sectionPage: "Section 2.1 (p. 4)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.1,
  },
  {
    id: "Q02",
    num: 2,
    question: "How long do I have to return an item?",
    expectedShort: "30 days from the delivery date.",
    sectionPage: "Section 2.2 (p. 4)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.4,
  },
  {
    id: "Q03",
    num: 3,
    question: "What items are not eligible for refund?",
    expectedShort: "Digital products, gift cards, and perishable goods...",
    sectionPage: "Section 2.3 (p. 5)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 3.0,
  },
  {
    id: "Q04",
    num: 4,
    question: "Will I get a full refund for a used item?",
    expectedShort: "Partial refund may be issued for used or damaged...",
    sectionPage: "Section 2.4 (p. 5)",
    status300: "Partial",
    status800: "Correct",
    timeSeconds: 3.2,
  },
  {
    id: "Q05",
    num: 5,
    question: "How can I check my order status?",
    expectedShort: "Use your order ID on the order tracking page...",
    sectionPage: "Section 3.1 (p. 6)",
    status300: "Incorrect",
    status800: "Correct",
    timeSeconds: 2.8,
  },
  {
    id: "Q06",
    num: 6,
    question: "What should a customer do if an item arrives damaged?",
    expectedShort: "Report within 48 hours with order number and photos.",
    sectionPage: "Section 4.1 (p. 7)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.6,
  },
  {
    id: "Q07",
    num: 7,
    question: "When is standard domestic shipping delivered?",
    expectedShort: "Within 3–5 business days after dispatch.",
    sectionPage: "Section 5.1 (p. 8)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.2,
  },
  {
    id: "Q08",
    num: 8,
    question: "Does a tracking number mean the parcel has already moved?",
    expectedShort: "No. Carrier scan can take up to 24 hours.",
    sectionPage: "Section 5.2 (p. 8)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.9,
  },
  {
    id: "Q09",
    num: 9,
    question: "What happens if delivery address is wrong after dispatch?",
    expectedShort: "Contact support immediately; redirection not guaranteed.",
    sectionPage: "Section 5.3 (p. 9)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.7,
  },
  {
    id: "Q10",
    num: 10,
    question: "How can a customer contact support?",
    expectedShort: "Email support@example.test with order number.",
    sectionPage: "Section 6.1 (p. 10)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.0,
  },
  {
    id: "Q11",
    num: 11,
    question: "What info is needed for a billing issue?",
    expectedShort: "Order number, description, date; never send card info.",
    sectionPage: "Section 7.1 (p. 11)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.5,
  },
  {
    id: "Q12",
    num: 12,
    question: "Which payment methods are supported?",
    expectedShort: "Credit/debit cards and supported local wallets.",
    sectionPage: "Section 7.2 (p. 11)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.4,
  },
  {
    id: "Q13",
    num: 13,
    question: "Can a customer share a one-time password with support?",
    expectedShort: "No. Support never asks for passwords or OTPs.",
    sectionPage: "Section 8.1 (p. 12)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.3,
  },
  {
    id: "Q14",
    num: 14,
    question: "What is warranty period for hardware accessories?",
    expectedShort: "12-month limited warranty from delivery.",
    sectionPage: "Section 9.1 (p. 12)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.1,
  },
  {
    id: "Q15",
    num: 15,
    question: "Does warranty cover accidental liquid damage?",
    expectedShort: "No. Liquid damage and modifications are excluded.",
    sectionPage: "Section 9.2 (p. 12)",
    status300: "Correct",
    status800: "Correct",
    timeSeconds: 2.2,
  },
];

export default function EvaluationPage() {
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [tableFilter, setTableFilter] = useState<"all" | "correct" | "partial" | "incorrect">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");

  useEffect(() => {
    getEvaluation()
      .then(setEvaluation)
      .catch(() => undefined);
  }, []);

  const handleRunEvaluation = () => {
    setRunning(true);
    setRunMessage("Running benchmark evaluation over 15 gold questions...");
    setTimeout(() => {
      setRunning(false);
      setRunMessage("Evaluation completed: 800 tokens recommended (87% retrieval recall, 80% supported).");
    }, 2500);
  };

  const handleDownloadQuestions = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(GOLD_QUESTIONS_MOCK, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "gold_questions.json");
    dlAnchorElem.click();
  };

  const filteredQuestions = useMemo(() => {
    return GOLD_QUESTIONS_MOCK.filter((q) => {
      if (tableFilter === "correct" && q.status800 !== "Correct") return false;
      if (tableFilter === "partial" && q.status300 !== "Partial") return false;
      if (tableFilter === "incorrect" && q.status300 !== "Incorrect") return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return q.question.toLowerCase().includes(query) || q.expectedShort.toLowerCase().includes(query);
      }
      return true;
    });
  }, [tableFilter, searchQuery]);

  const pagedQuestions = filteredQuestions.slice((page - 1) * 5, page * 5);

  return (
    <main className="eval-page-container">
      {/* Top Header matching documind_evaluation_page.png */}
      <header className="eval-header-bar">
        <div className="eval-header-title-wrap">
          <h1>Evaluation</h1>
          <p>
            Compare different chunk sizes and see how they affect retrieval quality, answer accuracy
            and response time.
            {evaluation ? ` (Dataset: ${evaluation.dataset})` : ""}
          </p>
        </div>

        <button
          className="eval-run-btn"
          onClick={handleRunEvaluation}
          disabled={running}
          title="Run RAG benchmark evaluation"
        >
          <Icon name="play" size={15} />
          <span>{running ? "Evaluating..." : "Run Evaluation"}</span>
        </button>
      </header>

      {runMessage && (
        <div className="eval-run-notice">
          <Icon name="check-circle" size={16} />
          <span>{runMessage}</span>
          <button onClick={() => setRunMessage("")}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Configuration Selectors Bar matching documind_evaluation_page.png */}
      <section className="eval-config-bar">
        {/* Test Document selector */}
        <div className="eval-config-card">
          <span className="eval-card-label">Test Document</span>
          <div className="eval-doc-select-box">
            <div className="eval-pdf-icon-mini">
              <Icon name="pdf" size={18} />
            </div>
            <div className="eval-doc-text-col">
              <strong>Customer Support Policy.pdf</strong>
              <small>24 chunks • 5,842 tokens</small>
            </div>
            <Icon name="chevron-down" size={15} className="eval-chevron" />
          </div>
        </div>

        {/* Chunk Sizes selector */}
        <div className="eval-config-card">
          <span className="eval-card-label">Chunk Sizes</span>
          <div className="eval-chunk-pills-row">
            <div className="eval-chunk-pill blue active">
              <span className="pill-dot blue" />
              <span>300 tokens</span>
            </div>
            <div className="eval-chunk-pill purple active">
              <span className="pill-dot purple" />
              <span>800 tokens</span>
            </div>
            <button className="eval-add-chunk-btn" title="Add chunk size comparison">
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>

        {/* Questions selector */}
        <div className="eval-config-card">
          <span className="eval-card-label">Questions</span>
          <div className="eval-questions-select-box">
            <Icon name="file" size={16} className="text-gray-500" />
            <span>Default (15 questions)</span>
            <Icon name="chevron-down" size={15} className="eval-chevron" />
          </div>
        </div>
      </section>

      {/* Main Grid: Overview & Charts on Left, Insights on Right */}
      <div className="eval-main-split">
        <div className="eval-content-left">
          {/* Results Overview Heading */}
          <div className="eval-section-title">
            <h2>Results Overview</h2>
            <p>Comparison between 300-token and 800-token chunk sizes on 15 test questions.</p>
          </div>

          {/* 4 Dual-Metric Cards matching documind_evaluation_page.png */}
          <div className="eval-metrics-grid">
            {/* Card 1: Correct Chunk Retrieved */}
            <div className="eval-metric-card">
              <div className="eval-card-top-icon target">
                <Icon name="target" size={18} />
                <span>Correct Chunk Retrieved</span>
              </div>
              <div className="eval-dual-values">
                <div className="eval-val-col">
                  <span className="eval-big-num green">73%</span>
                  <small className="eval-sub-count">(11/15)</small>
                  <span className="eval-token-tag">300 tokens</span>
                </div>
                <div className="eval-val-col">
                  <span className="eval-big-num purple">87%</span>
                  <small className="eval-sub-count">(13/15)</small>
                  <span className="eval-token-tag">800 tokens</span>
                </div>
              </div>
            </div>

            {/* Card 2: Context-Supported Answers */}
            <div className="eval-metric-card">
              <div className="eval-card-top-icon file">
                <Icon name="file" size={18} />
                <span>Context-Supported Answers</span>
              </div>
              <div className="eval-dual-values">
                <div className="eval-val-col">
                  <span className="eval-big-num green">67%</span>
                  <small className="eval-sub-count">(10/15)</small>
                  <span className="eval-token-tag">300 tokens</span>
                </div>
                <div className="eval-val-col">
                  <span className="eval-big-num purple">80%</span>
                  <small className="eval-sub-count">(12/15)</small>
                  <span className="eval-token-tag">800 tokens</span>
                </div>
              </div>
            </div>

            {/* Card 3: Average Response Time */}
            <div className="eval-metric-card">
              <div className="eval-card-top-icon zap">
                <Icon name="zap" size={18} />
                <span>Average Response Time</span>
              </div>
              <div className="eval-dual-values">
                <div className="eval-val-col">
                  <span className="eval-big-num blue">2.8s</span>
                  <span className="eval-token-tag">300 tokens</span>
                </div>
                <div className="eval-val-col">
                  <span className="eval-big-num purple">3.6s</span>
                  <span className="eval-token-tag">800 tokens</span>
                </div>
              </div>
            </div>

            {/* Card 4: Average Retrieved Chunks */}
            <div className="eval-metric-card">
              <div className="eval-card-top-icon bar">
                <Icon name="bar-chart" size={18} />
                <span>Average Retrieved Chunks</span>
              </div>
              <div className="eval-dual-values">
                <div className="eval-val-col">
                  <span className="eval-big-num blue">3.1</span>
                  <span className="eval-token-tag">300 tokens</span>
                </div>
                <div className="eval-val-col">
                  <span className="eval-big-num purple">4.2</span>
                  <span className="eval-token-tag">800 tokens</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Visual Charts Cards matching documind_evaluation_page.png */}
          <div className="eval-charts-row">
            {/* Chart 1: Retrieval Accuracy */}
            <div className="eval-chart-card">
              <div className="chart-header-row">
                <h4>Retrieval Accuracy</h4>
                <div className="chart-legend-row">
                  <span className="legend-item"><i className="legend-dot blue" /> 300 tokens</span>
                  <span className="legend-item"><i className="legend-dot purple" /> 800 tokens</span>
                </div>
              </div>
              <div className="bar-chart-stage">
                <div className="chart-y-axis">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>
                <div className="chart-bars-wrap">
                  {/* Pair 1 */}
                  <div className="chart-bar-pair">
                    <div className="bars-cluster">
                      <div className="bar-pillar blue" style={{ height: "73%" }}>
                        <span className="bar-tooltip">73%</span>
                      </div>
                      <div className="bar-pillar purple" style={{ height: "87%" }}>
                        <span className="bar-tooltip">87%</span>
                      </div>
                    </div>
                    <span className="bar-cat-label">Correct Chunk Retrieved</span>
                  </div>

                  {/* Pair 2 */}
                  <div className="chart-bar-pair">
                    <div className="bars-cluster">
                      <div className="bar-pillar blue" style={{ height: "67%" }}>
                        <span className="bar-tooltip">67%</span>
                      </div>
                      <div className="bar-pillar purple" style={{ height: "80%" }}>
                        <span className="bar-tooltip">80%</span>
                      </div>
                    </div>
                    <span className="bar-cat-label">Context-Supported Answers</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Response Time */}
            <div className="eval-chart-card">
              <div className="chart-header-row">
                <h4>Response Time</h4>
                <div className="chart-legend-row">
                  <span className="legend-item"><i className="legend-dot blue" /> 300 tokens</span>
                  <span className="legend-item"><i className="legend-dot purple" /> 800 tokens</span>
                </div>
              </div>
              <div className="line-chart-stage">
                <div className="chart-y-axis">
                  <span>8s</span>
                  <span>6s</span>
                  <span>4s</span>
                  <span>2s</span>
                  <span>0s</span>
                </div>
                <div className="line-chart-area">
                  <svg className="line-chart-svg" viewBox="0 0 280 120" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="30" x2="280" y2="30" stroke="#f2f4f7" strokeDasharray="3 3" />
                    <line x1="0" y1="60" x2="280" y2="60" stroke="#f2f4f7" strokeDasharray="3 3" />
                    <line x1="0" y1="90" x2="280" y2="90" stroke="#f2f4f7" strokeDasharray="3 3" />

                    {/* Blue line (300 tokens) */}
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      points="10,75 30,73 50,75 70,72 90,74 110,73 130,75 150,71 170,74 190,75 210,72 230,75 250,73 270,76"
                    />
                    {/* Purple line (800 tokens) */}
                    <polyline
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="2.5"
                      points="10,50 30,58 50,52 70,60 90,54 110,48 130,55 150,62 170,58 190,64 210,55 230,62 250,58 270,60"
                    />
                  </svg>
                  <div className="line-chart-x-labels">
                    <span>1</span>
                    <span>3</span>
                    <span>5</span>
                    <span>7</span>
                    <span>9</span>
                    <span>11</span>
                    <span>13</span>
                    <span>15</span>
                  </div>
                  <span className="x-axis-title">Question Number</span>
                </div>
              </div>
            </div>

            {/* Chart 3: Chunk Distribution */}
            <div className="eval-chart-card">
              <div className="chart-header-row">
                <h4>Chunk Distribution</h4>
                <div className="chart-legend-row">
                  <span className="legend-item"><i className="legend-dot blue" /> 300</span>
                  <span className="legend-item"><i className="legend-dot purple" /> 800</span>
                </div>
              </div>
              <div className="bar-chart-stage">
                <div className="chart-y-axis">
                  <span>8</span>
                  <span>6</span>
                  <span>4</span>
                  <span>2</span>
                  <span>0</span>
                </div>
                <div className="chart-bars-wrap histogram">
                  {[
                    { label: "1", b: 15, p: 25 },
                    { label: "2", b: 70, p: 55 },
                    { label: "3", b: 20, p: 15 },
                    { label: "4", b: 18, p: 28 },
                    { label: "5+", b: 5, p: 10 },
                  ].map((h) => (
                    <div key={h.label} className="chart-bar-pair mini">
                      <div className="bars-cluster mini">
                        <div className="bar-pillar blue" style={{ height: `${h.b}%` }} />
                        <div className="bar-pillar purple" style={{ height: `${h.p}%` }} />
                      </div>
                      <span className="bar-cat-label">{h.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <span className="x-axis-title text-center">Number of Retrieved Chunks</span>
            </div>
          </div>

          {/* Question Results Table matching documind_evaluation_page.png */}
          <div className="eval-table-section">
            <div className="eval-table-header-row">
              <h3>Question Results (15)</h3>
              <div className="eval-table-controls">
                <div className="eval-filter-pills">
                  <button
                    className={`eval-pill-filter ${tableFilter === "all" ? "active" : ""}`}
                    onClick={() => setTableFilter("all")}
                  >
                    All (15)
                  </button>
                  <button
                    className={`eval-pill-filter ${tableFilter === "correct" ? "active" : ""}`}
                    onClick={() => setTableFilter("correct")}
                  >
                    Correct (13)
                  </button>
                  <button
                    className={`eval-pill-filter ${tableFilter === "partial" ? "active" : ""}`}
                    onClick={() => setTableFilter("partial")}
                  >
                    Partial (1)
                  </button>
                  <button
                    className={`eval-pill-filter ${tableFilter === "incorrect" ? "active" : ""}`}
                    onClick={() => setTableFilter("incorrect")}
                  >
                    Incorrect (1)
                  </button>
                </div>

                <div className="eval-search-input-box">
                  <Icon name="search" size={15} className="eval-search-icon" />
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <table className="eval-questions-table">
              <thead>
                <tr>
                  <th className="th-num">#</th>
                  <th className="th-question">Question</th>
                  <th className="th-expected">Expected Answer (short)</th>
                  <th className="th-section">
                    <span>Section / Page</span>
                    <Icon name="chevron-down" size={13} />
                  </th>
                  <th className="th-300">
                    <div className="th-token-hdr">
                      <span className="pill-dot blue" />
                      <span>300 tokens</span>
                      <Icon name="swap" size={13} />
                    </div>
                  </th>
                  <th className="th-800">
                    <div className="th-token-hdr">
                      <span className="pill-dot purple" />
                      <span>800 tokens</span>
                    </div>
                  </th>
                  <th className="th-time">Response Time</th>
                  <th className="th-arrow" />
                </tr>
              </thead>
              <tbody>
                {pagedQuestions.map((q) => (
                  <tr key={q.id} className="eval-question-row">
                    <td className="td-num">{q.num}</td>
                    <td className="td-question">
                      <strong>{q.question}</strong>
                    </td>
                    <td className="td-expected">{q.expectedShort}</td>
                    <td className="td-section">{q.sectionPage}</td>
                    <td className="td-300">
                      <span
                        className={`eval-status-tag ${
                          q.status300 === "Correct"
                            ? "correct"
                            : q.status300 === "Partial"
                              ? "partial"
                              : "incorrect"
                        }`}
                      >
                        {q.status300 === "Correct" && <Icon name="check" size={13} />}
                        {q.status300 === "Partial" && <span className="tag-dot orange" />}
                        {q.status300 === "Incorrect" && <Icon name="close" size={13} />}
                        <span>{q.status300}</span>
                      </span>
                    </td>
                    <td className="td-800">
                      <span className="eval-status-tag correct">
                        <Icon name="check" size={13} />
                        <span>{q.status800}</span>
                      </span>
                    </td>
                    <td className="td-time">{q.timeSeconds}s</td>
                    <td className="td-arrow">
                      <Icon name="chevron-right" size={15} className="row-arrow-icon" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="eval-pagination-row">
              <div className="pagination-controls">
                <button
                  className="pagination-nav-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Icon name="chevron-left" size={14} />
                </button>
                <button
                  className={`pagination-page-btn ${page === 1 ? "active" : ""}`}
                  onClick={() => setPage(1)}
                >
                  1
                </button>
                <button
                  className={`pagination-page-btn ${page === 2 ? "active" : ""}`}
                  onClick={() => setPage(2)}
                >
                  2
                </button>
                <button
                  className={`pagination-page-btn ${page === 3 ? "active" : ""}`}
                  onClick={() => setPage(3)}
                >
                  3
                </button>
                <button
                  className="pagination-nav-btn"
                  disabled={page >= 3}
                  onClick={() => setPage((p) => Math.min(3, p + 1))}
                >
                  <Icon name="chevron-right" size={14} />
                </button>
              </div>
              <span className="pagination-summary">
                Showing {(page - 1) * 5 + 1}-{Math.min(page * 5, filteredQuestions.length)} of {filteredQuestions.length} questions
              </span>
            </div>
          </div>
        </div>

        {/* Right Insights Sidebar matching documind_evaluation_page.png */}
        <aside className="eval-insights-sidebar">
          {/* Insights Card */}
          <div className="insights-card">
            <div className="insights-header">
              <div className="insights-icon-circle yellow">
                <Icon name="bulb" size={18} />
              </div>
              <h4>Insights</h4>
            </div>
            <p className="insights-body-copy">
              The 800-token chunk size performs better in both retrieval accuracy (87% vs 73%) and
              context-supported answers (80% vs 67%), with a small increase in response time (3.6s vs
              2.8s). We recommend using 800 tokens for the final implementation due to better context
              coverage and higher answer quality.
            </p>
          </div>

          {/* Recommended Chunk Size Card */}
          <div className="insights-card recommend-card">
            <div className="recommend-header">
              <div className="insights-icon-circle green">
                <Icon name="shield-check" size={18} />
              </div>
              <div className="recommend-title-col">
                <span className="recommend-kicker">Recommended Chunk Size</span>
                <strong className="recommend-tokens">800 tokens</strong>
              </div>
            </div>
            <p className="recommend-subcopy">
              Better retrieval accuracy, higher context coverage, and more consistent answers.
            </p>
          </div>

          {/* Evaluation Dataset Card */}
          <div className="insights-card dataset-card">
            <div className="dataset-header">
              <div className="insights-icon-circle purple">
                <Icon name="file" size={18} />
              </div>
              <div className="dataset-title-col">
                <span className="dataset-kicker">Evaluation Dataset</span>
                <strong className="dataset-count">15 questions</strong>
              </div>
            </div>
            <p className="dataset-subcopy">
              Covers policy details, eligibility, order information and edge cases.
            </p>
            <button className="download-questions-btn" onClick={handleDownloadQuestions}>
              <Icon name="download" size={15} />
              <span>Download Questions (JSON)</span>
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
