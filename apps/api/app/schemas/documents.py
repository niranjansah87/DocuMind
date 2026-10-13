import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    document_id: uuid.UUID
    filename: str
    status: str
    duplicate: bool
    chunk_count: int


class DocumentListItem(BaseModel):
    document_id: uuid.UUID
    filename: str
    status: str
    created_at: datetime
    byte_size: int
    mime_type: str
    page_count: int | None


class DocumentListResponse(BaseModel):
    items: list[DocumentListItem]


class DocumentChunkItem(BaseModel):
    chunk_id: uuid.UUID
    chunk_index: int
    text: str
    token_count: int
    section: str | None
    page_start: int | None
    page_end: int | None


class DocumentDetailResponse(DocumentListItem):
    chunk_count: int
    chunk_size_tokens: int | None
    overlap_tokens: int | None
    chunks: list[DocumentChunkItem]
