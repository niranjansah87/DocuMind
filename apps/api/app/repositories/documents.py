import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document, DocumentChunk


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_duplicate(self, owner_id: uuid.UUID, content_hash: str) -> Document | None:
        result = await self.session.execute(
            select(Document).where(Document.owner_id == owner_id, Document.content_sha256 == content_hash)
        )
        return result.scalar_one_or_none()

    async def list_ready(self, owner_id: uuid.UUID) -> list[Document]:
        result = await self.session.execute(
            select(Document).where(Document.owner_id == owner_id).order_by(Document.created_at.desc())
        )
        return list(result.scalars())

    async def count_chunks(self, document_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == document_id)
        )
        return len(result.scalars().all())

    async def retrieve(
        self,
        owner_id: uuid.UUID,
        document_ids: Sequence[uuid.UUID],
        embedding: list[float],
        limit: int,
    ) -> list[tuple[DocumentChunk, Document, float]]:
        distance = DocumentChunk.embedding.cosine_distance(embedding)
        statement = (
            select(DocumentChunk, Document, distance.label("distance"))
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                Document.owner_id == owner_id,
                Document.status == "ready",
                Document.id.in_(document_ids),
            )
            .order_by(distance)
            .limit(limit)
        )
        return [(chunk, document, float(score)) for chunk, document, score in (await self.session.execute(statement)).all()]
