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


class DocumentListResponse(BaseModel):
    items: list[DocumentListItem]
