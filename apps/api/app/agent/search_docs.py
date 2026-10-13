import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.repositories.documents import DocumentRepository
from app.schemas.chat import Citation


class SearchDocsArguments(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    query: str = Field(min_length=1, max_length=4000)
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)
    top_k: int = Field(default=5, ge=1, le=20)


class SearchDocsResult(BaseModel):
    items: list[Citation]


async def search_docs(
    repository: DocumentRepository,
    owner_id: uuid.UUID,
    arguments: SearchDocsArguments,
    query_embedding: list[float],
) -> SearchDocsResult:
    rows = await repository.retrieve(
        owner_id,
        arguments.document_ids,
        query_embedding,
        arguments.top_k,
    )
    return SearchDocsResult(
        items=[
            Citation(
                document_id=document.id,
                document_name=document.filename,
                chunk_id=chunk.id,
                chunk_index=chunk.chunk_index,
                section=chunk.section_title,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                quote=chunk.text[:500],
            )
            for chunk, document, _ in rows
        ]
    )
