import hashlib
import uuid
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import Document, DocumentChunk
from app.ingestion.chunker import chunk_text
from app.ingestion.parser import parse_document
from app.ingestion.validation import validate_upload
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.repositories.documents import DocumentRepository


@dataclass(frozen=True, slots=True)
class IngestionResult:
    document: Document
    duplicate: bool
    chunk_count: int


class IngestionService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.repository = DocumentRepository(session)
        self.provider = OpenAICompatibleProvider(settings)

    async def ingest(self, owner_id: uuid.UUID, filename: str | None, content_type: str | None, content: bytes) -> IngestionResult:
        upload = validate_upload(filename, content_type, content, self.settings.max_upload_bytes)
        content_hash = hashlib.sha256(upload.content).hexdigest()
        existing = await self.repository.find_duplicate(owner_id, content_hash)
        if existing:
            return IngestionResult(existing, True, await self.repository.count_chunks(existing.id))
        parsed = parse_document(upload)
        chunks = chunk_text(
            parsed.text,
            self.settings.chunk_size_tokens,
            self.settings.chunk_overlap_tokens,
            pages=parsed.pages,
        )
        if not chunks:
            raise AppError("DOCUMENT_UNPARSEABLE", "The document contains no extractable text.", 422)
        document = Document(
            owner_id=owner_id,
            filename=upload.filename,
            content_sha256=content_hash,
            mime_type=upload.mime_type,
            byte_size=len(upload.content),
            status="processing",
            page_count=parsed.page_count,
        )
        self.session.add(document)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            existing = await self.repository.find_duplicate(owner_id, content_hash)
            if not existing:
                raise
            return IngestionResult(existing, True, await self.repository.count_chunks(existing.id))
        vectors = await self.provider.embed([chunk.text for chunk in chunks])
        self.session.add_all(
            DocumentChunk(
                document_id=document.id,
                chunk_index=chunk.index,
                text=chunk.text,
                token_count=chunk.token_count,
                section_title=chunk.section_title,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                embedding=vector,
                embedding_model=self.settings.embedding_model,
                chunk_size_tokens=self.settings.chunk_size_tokens,
                overlap_tokens=self.settings.chunk_overlap_tokens,
            )
            for chunk, vector in zip(chunks, vectors, strict=True)
        )
        document.status = "ready"
        await self.session.commit()
        return IngestionResult(document, False, len(chunks))
