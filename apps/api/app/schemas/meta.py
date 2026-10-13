from pydantic import BaseModel


class AppMetaResponse(BaseModel):
    application_name: str
    workspace_name: str
    scope_label: str
    accepted_extensions: list[str]
    max_upload_bytes: int
    max_query_chars: int
    suggested_questions: list[str]
    order_example: str
    order_number_pattern: str
    embedding_model: str
    embedding_dimensions: int
    retrieval_strategy: str
    retrieval_top_k: int
    chunk_size_tokens: int
    chunk_overlap_tokens: int
    auth_required: bool = False


class EvaluationQuestion(BaseModel):
    id: str
    question: str
    expected_answer: str
    gold_section: str


class EvaluationResponse(BaseModel):
    dataset: str
    questions: list[EvaluationQuestion]
    embedding_model: str
    embedding_dimensions: int
    retrieval_strategy: str
    chunk_sizes: list[int]
    status: str
    runs: list[dict[str, object]]
    command: str
