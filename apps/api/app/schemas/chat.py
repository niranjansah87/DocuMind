import uuid

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    message: str = Field(min_length=1)
    document_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    conversation_id: uuid.UUID | None = None


class Citation(BaseModel):
    document_id: uuid.UUID
    document_name: str
    chunk_id: uuid.UUID
    chunk_index: int
    section: str | None
    page_start: int | None
    page_end: int | None
    quote: str


class ChatResponse(BaseModel):
    answer: str
    route: str
    abstained: bool
    citations: list[Citation]
    latency_ms: int
