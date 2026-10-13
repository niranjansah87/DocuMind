import uuid
from types import SimpleNamespace

import pytest

from app.agent.search_docs import SearchDocsArguments, search_docs


class ScopedRepository:
    def __init__(self) -> None:
        self.received: tuple[uuid.UUID, list[uuid.UUID], int] | None = None

    async def retrieve(
        self,
        owner_id: uuid.UUID,
        document_ids: list[uuid.UUID],
        embedding: list[float],
        limit: int,
    ) -> list[tuple[object, object, float]]:
        self.received = owner_id, document_ids, limit
        chunk = SimpleNamespace(
            id=uuid.uuid4(),
            chunk_index=2,
            section_title="Returns",
            page_start=None,
            page_end=None,
            text="Returns are accepted within 30 days.",
        )
        document = SimpleNamespace(id=document_ids[0], filename="policy.txt")
        return [(chunk, document, 0.12)]


@pytest.mark.asyncio
async def test_search_docs_preserves_scope_and_citation_metadata() -> None:
    owner_id = uuid.uuid4()
    document_id = uuid.uuid4()
    repository = ScopedRepository()

    result = await search_docs(
        repository,  # type: ignore[arg-type]
        owner_id,
        SearchDocsArguments(query="return window", document_ids=[document_id], top_k=3),
        [0.0] * 1536,
    )

    assert repository.received == (owner_id, [document_id], 3)
    assert result.items[0].document_id == document_id
    assert result.items[0].chunk_index == 2
