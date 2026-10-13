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

  ----------------------------------------------------------------------------
  Run                         Chunk size Retrieval        Status
  ---------------- --------------------- ---------------- --------------------
  A                                  300 Vector-only      Pending
                                                          implementation/run

  B                                  800 Vector-only      Pending
                                                          implementation/run

  C                                  300 Hybrid (+        Pending
                                         reranker if      implementation/run
                                         implemented)     

  D                                  800 Hybrid (+        Pending
                                         reranker if      implementation/run
                                         implemented)     
  ----------------------------------------------------------------------------

If implementation time only permits the required two chunk-size runs,
complete A and B first. Do not report C/D unless they were actually run.

## 6. Result table template

  Metric                                     300 tokens   800 tokens
  ---------------------------------------- ------------ ------------
  Questions tested                                   15           15
  Correct evidence retrieved                    Pending      Pending
  Retrieval recall@k                            Pending      Pending
  Answers supported by retrieved context        Pending      Pending
  Citation-valid answers                        Pending      Pending
  Mean latency (ms)                             Pending      Pending
  Median latency (ms)                           Pending      Pending
  Failed requests                               Pending      Pending

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
