# Retrieval and Answer Evaluation Protocol

## 1. Purpose

Compare 300-token and 800-token chunk configurations, then compare
vector-only retrieval with hybrid retrieval/reranking if implemented.
This evaluation is a required deliverable.

## 2. Gold set

Use the 15 questions in `GOLD_QUESTIONS.md` against
`data/sample_knowledge_document.md`. Each question defines an expected
answer and target section. The expected section is the human-grounded
reference; the exact chunk ID changes by chunk configuration and must be
mapped during each run.

## 3. Controlled variables

Keep constant where possible: - Sample document bytes and parser
version. - Embedding model and vector dimensions. - Chunk overlap and
tokenizer. - Retrieval top-k and relevance policy, unless explicitly
testing them. - LLM model, prompt, temperature, output token limit and
provider settings. - Runtime environment and network conditions. - Gold
questions and scoring rules.

Only chunk size should change in the primary 300-vs-800 comparison.
Record any unavoidable differences.

## 4. Metrics and definitions

### Correct source chunk retrieved

For each question, mark success when at least one retrieved chunk
contains the gold section's evidence needed to answer the question.
Because chunk boundaries differ, score by evidence/source span or target
section---not by expecting the same chunk UUID across configurations. -
`correct_chunk_retrieved_count`: number of questions with target
evidence in retrieved top-k. - `retrieval_recall_at_k = count / 15`.

### Answer supported by retrieved context

A question passes when the returned answer's material claims are
entailed by the retrieved context and its citations point only to
retrieved source chunks. An abstention is correct for an unsupported
question, but the 15 primary gold questions are answerable; for them,
abstention should be recorded as not answered/supported rather than
counted as a grounded answer.

### Average response time

Measure end-to-end chat latency from API request start to final response
completion. State whether provider/network time is included
(recommended: yes). Use monotonic clock. -
`mean_latency_ms = sum(latency_ms) / number_of_successful_measurements`. -
Report failed requests separately; do not silently omit them. - For
stronger evidence, run each question at least 3 times and report
per-configuration mean and median. If time permits, include p95.

### Optional metrics

-   MRR or Recall@k for retrieval.
-   Citation validity rate.
-   Abstention precision on a separate set of unanswerable questions.
-   Cost per answer if provider usage data is available.

## 5. Run matrix

| Run | Chunk size (tokens) | Retrieval Strategy | Measured Status |
| :--- | :--- | :--- | :--- |
| **A** | 300 | Vector-only (pgvector cosine) | **Completed** (100% recall, 93% supported) |
| **B** | 800 | Vector-only (pgvector cosine) | **Completed** (100% recall, 60% supported) |
| **C** | 300 | Hybrid (Vector + Full-Text RRF) | **Completed** (100% recall, 100% supported) |
| **D** | 800 | Hybrid (Vector + Full-Text RRF) | **Completed** (100% recall, 100% supported) |

All 4 configurations were executed against the fixed 15 gold evaluation questions using `text-embedding-3-small` (1536 dimensions) and `data/sample_knowledge_document.txt`. Raw per-question data is preserved in `evaluation/results/latest.json`.

## 6. Measured Benchmark Results

### 6.1 Vector-Only Retrieval Comparison

| Metric | 300 tokens (Vector) | 800 tokens (Vector) | Tradeoff Analysis |
| :--- | :---: | :---: | :--- |
| Questions tested | 15 | 15 | Gold question set |
| Correct evidence retrieved | 15 / 15 | 15 / 15 | Both achieve 100% recall@5 |
| Retrieval recall@k | 100% | 100% | Evidence successfully retrieved |
| Answers supported by context | 14 / 15 (93.3%) | 9 / 15 (60.0%) | 300 tokens gives tighter prompt context |
| Citation-valid answers | 14 / 15 (93.3%) | 9 / 15 (60.0%) | Verified against retrieved candidate chunks |
| Mean latency (ms) | 1,858 ms | 913 ms | 800 tokens had faster early exits |
| Median latency (ms) | 1,760 ms | 1,406 ms | Comparable median latency |
| Failed requests | 0 | 0 | Zero crashes or dropped requests |

### 6.2 Hybrid Retrieval Comparison (Vector + Full-Text RRF)

| Metric | 300 tokens (Hybrid) | 800 tokens (Hybrid) | Tradeoff Analysis |
| :--- | :---: | :---: | :--- |
| Questions tested | 15 | 15 | Gold question set |
| Correct evidence retrieved | 15 / 15 | 15 / 15 | 100% retrieval recall |
| Retrieval recall@k | 100% | 100% | Both capture target sections |
| Answers supported by context | 15 / 15 (100%) | 15 / 15 (100%) | Hybrid retrieval achieves 100% answer accuracy |
| Citation-valid answers | 15 / 15 (100%) | 15 / 15 (100%) | 100% of claims cite retrieved chunks |
| Mean latency (ms) | 1,794 ms | 1,591 ms | 800 tokens is 203 ms faster on average |
| Median latency (ms) | 1,600 ms | 1,551 ms | Consistent sub-2-second response time |
| Failed requests | 0 | 0 | Zero errors or timeouts |

## 7. Chunk-size selection rule

Choose the configuration with the strongest balance of: 1. Retrieval
success on the gold questions. 2. Grounded answer and citation validity.
3. Latency/cost. 4. Context precision (less irrelevant material) and
context completeness (not splitting related facts). 5. Operational
simplicity.

Do not declare 300 or 800 inherently superior. Smaller chunks may
improve precision but split multi-sentence facts; larger chunks may
preserve context but dilute similarity and increase prompt tokens. The
actual sample and retrieval settings determine the result.

## 8. Reproducibility requirements

Record: - Git commit or version. - Timestamp and environment. -
Provider/model identifiers and embedding dimensions. - Chunk size,
overlap, tokenizer and top-k. - Similarity metric/threshold. - Retrieval
strategy and reranker model if used. - Number of repetitions. - Raw
per-question output or a machine-readable JSON/CSV artifact. - Exact
script command.

## 9. Reporting language

Use "observed in this 15-question sample," not "proves universally." The
test set is small and constructed; results indicate fit for this demo,
not general RAG quality across arbitrary documents.
