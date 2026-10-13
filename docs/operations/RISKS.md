# Risks, Open Decisions and Mitigations

## 1. Risk register

  -------------------------------------------------------------------------------------
  ID             Risk              Likelihood /   Mitigation        Trigger
                                   impact                           
  -------------- ----------------- -------------- ----------------- -------------------
  R1             External          Medium / High  Early smoke test; Provider call fails
                 LLM/embedding                    clear errors;     
                 quota or key                     mock tests;       
                 issue                            fallback for      
                                                  generation        

  R2             Deadline overrun  High / High    Vertical slices;  Core upload/chat
                 from optional                    prioritize        not working by
                 complexity                       reviewer path;    midpoint
                                                  defer             
                                                  nonessential      
                                                  infra             

  R3             Unreliable        Medium / High  Same gold         Metrics conflict or
                 chunk-size                       set/settings,     vary widely
                 conclusion                       repeated runs,    
                                                  per-question logs 

  R4             False citations   Medium / High  Server-side       Citation ID absent
                                                  citation          from retrieved set
                                                  resolution and    
                                                  validation        

  R5             Hallucinated      Medium / High  Tool result       Tool
                 order status on                  schema; no answer exception/timeout
                 tool failure                     from failed tool  

  R6             Ticket written    Low / High     Separate          Write path invoked
                 without                          prepare/confirm   directly
                 confirmation                     endpoints,        
                                                  expiry,           
                                                  idempotency       

  R7             Cross-document    Medium / High  SQL-level filters Unauthorized
                 retrieval leak                   and isolation     document ID
                                                  tests             supplied

  R8             PDF extraction    Medium /       Clear error;      Scanned PDF
                 returns empty     Medium         disclose OCR not  uploaded
                 text                             supported         

  R9             Docker cold start Medium / High  Health checks, DB API starts before
                 failure                          readiness,        DB ready
                                                  clean-clone test  

  R10            Model provider    Medium /       Calibrate         Many relevant
                 changes score     Medium         threshold per     queries abstain
                 semantics                        metric/model      

  R11            Hybrid/reranker   Medium /       Measure against   Higher latency/no
                 adds latency      Medium         baseline;         recall gain
                 without quality                  configurable      
                 gain                             switch            

  R12            Duplicate upload  Low / High     Database          Concurrent
                 race                             uniqueness and    same-file upload
                                                  transaction       

  R13            Demo auth scope   Medium / High  Document demo     No real identity
                 misrepresented as                boundary; scope   layer
                 multi-tenant                     all repositories  
                 security                                           

  R14            Evaluation table  Low / High     Generate from     Results not
                 contains guessed                 script; mark      reproducible
                 values                           pending until run 
  -------------------------------------------------------------------------------------

## 2. Open decisions before scaffold

1.  **LLM provider and model:** not mandated by assignment. Choose based
    on API access, reliability, cost and structured/tool support; set
    via environment.
2.  **Embedding model and dimensions:** select once, record exact
    dimensions, and use consistently for documents and queries.
3.  **Tokenizer:** choose model-compatible tokenization for the 300/800
    comparison.
4.  **Overlap:** proposed 50 tokens for both sizes; confirm feasibility
    with chunker.
5.  **Retrieval threshold:** must be calibrated; do not hardcode an
    untested universal threshold.
6.  **Reranker:** choose a provider/local model only if feasible;
    otherwise clearly report the limitation.
7.  **Authentication:** assignment requires metadata/permission filters,
    but does not prescribe auth. Decide whether demo scope is
    single-user or implement minimal auth; never claim stronger
    guarantees than built.
8.  **Streaming protocol:** proposed SSE.
9.  **Duplicate response semantics:** return existing document ID and
    `duplicate=true` or a documented conflict response; idempotent
    success is preferred for this demo.
10. **Ticket confirmation UX:** pending action with expiry and explicit
    confirm button.
11. **Evaluation repetitions:** proposed at least 3 per
    question/configuration if time allows; at minimum run all 15 for
    both sizes and disclose repetition count.

## 3. Recommended tradeoffs to explain in interview

-   Modular monolith over microservices: less operational overhead,
    clear module boundaries.
-   PostgreSQL/pgvector over external vector DB: matches requirements
    and keeps data in one system.
-   Direct RAG over agent for ordinary questions: lower latency/cost and
    less nondeterminism.
-   Strict abstention over plausible guesses: trustworthiness over
    superficial answer rate.
-   Hybrid search only if measured: complexity should earn its place.
-   Explicit ticket confirmation: safe side-effect handling.
-   Bounded synchronous ingestion for demo: simple now; background
    workers if file sizes/traffic grow.
