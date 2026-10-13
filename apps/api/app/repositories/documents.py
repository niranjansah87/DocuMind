import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document, DocumentChunk


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_duplicate(
        self, owner_id: uuid.UUID, content_hash: str
    ) -> Document | None:
        result = await self.session.execute(
            select(Document).where(
                Document.owner_id == owner_id, Document.content_sha256 == content_hash
            )
        )
        return result.scalar_one_or_none()

    async def list_ready(self, owner_id: uuid.UUID) -> list[Document]:
        result = await self.session.execute(
            select(Document)
            .where(Document.owner_id == owner_id)
            .order_by(Document.created_at.desc())
        )
        return list(result.scalars())

    async def count_chunks(self, document_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == document_id)
        )
        return len(result.scalars().all())

    async def get_owned(
        self, owner_id: uuid.UUID, document_id: uuid.UUID
    ) -> Document | None:
        result = await self.session.execute(
            select(Document).where(
                Document.owner_id == owner_id, Document.id == document_id
            )
        )
        return result.scalar_one_or_none()

    async def list_chunks(
        self, owner_id: uuid.UUID, document_id: uuid.UUID
    ) -> list[DocumentChunk]:
        result = await self.session.execute(
            select(DocumentChunk)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.owner_id == owner_id, Document.id == document_id)
            .order_by(DocumentChunk.chunk_index)
        )
        return list(result.scalars())

    async def delete_owned(self, owner_id: uuid.UUID, document_id: uuid.UUID) -> bool:
        document = await self.get_owned(owner_id, document_id)
        if not document:
            return False
        await self.session.delete(document)
        await self.session.commit()
        return True

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
        return [
            (chunk, document, float(score))
            for chunk, document, score in (await self.session.execute(statement)).all()
        ]

    async def retrieve_hybrid(
        self,
        owner_id: uuid.UUID,
        document_ids: Sequence[uuid.UUID],
        query: str,
        embedding: list[float],
        limit: int,
    ) -> list[tuple[DocumentChunk, Document, float]]:
        pool_size = min(limit * 2, 40)
        vector_rows = await self.retrieve(owner_id, document_ids, embedding, pool_size)
        keyword_query = " OR ".join(query.replace('"', " ").split()[:32])
        query_vector = func.websearch_to_tsquery("english", keyword_query)
        document_vector = func.to_tsvector("english", DocumentChunk.text)
        rank = func.ts_rank_cd(document_vector, query_vector)
        statement = (
            select(DocumentChunk, Document, rank.label("rank"))
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                Document.owner_id == owner_id,
                Document.status == "ready",
                Document.id.in_(document_ids),
                document_vector.op("@@")(query_vector),
            )
            .order_by(rank.desc())
            .limit(pool_size)
        )
        keyword_rows = list((await self.session.execute(statement)).all())
        fused: dict[uuid.UUID, tuple[float, DocumentChunk, Document, float]] = {}
        for rank_index, (chunk, document, distance) in enumerate(vector_rows, 1):
            fused[chunk.id] = (1 / (60 + rank_index), chunk, document, distance)
        for rank_index, (chunk, document, _) in enumerate(keyword_rows, 1):
            previous = fused.get(chunk.id)
            score = 1 / (60 + rank_index) + (previous[0] if previous else 0)
            distance = previous[3] if previous else 0.45
            fused[chunk.id] = (score, chunk, document, distance)
        rows = sorted(fused.values(), key=lambda item: item[0], reverse=True)[:limit]
        return [(chunk, document, distance) for _, chunk, document, distance in rows]
