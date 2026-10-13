import uuid
from types import SimpleNamespace

import pytest

from app.core.config import Settings
from app.schemas.tools import OrderStatusResponse
from app.services.chat import UNKNOWN_ANSWER, ChatService


class FakeRepository:
    async def retrieve(self, owner_id: uuid.UUID, document_ids: list[uuid.UUID], embedding: list[float], limit: int) -> list[tuple[object, object, float]]:
        chunk = SimpleNamespace(
            id=uuid.uuid4(),
            text="Returns are allowed within 30 days.",
            chunk_index=0,
            section_title="Returns",
            page_start=None,
            page_end=None,
        )
        document = SimpleNamespace(id=document_ids[0], filename="policy.txt")
        return [(chunk, document, 0.1)]


class FakeOrderService:
    async def get_status(self, owner_id: uuid.UUID, order_number: str) -> OrderStatusResponse:
        return OrderStatusResponse(found=False, order_number=order_number)


class SpoofingProvider:
    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * 1536]

    async def generate(self, messages: list[dict[str, str]]) -> str:
        return f'{{"answer":"Thirty days.","citation_ids":["{uuid.uuid4()}"]}}'


@pytest.mark.asyncio
async def test_invalid_model_citation_causes_abstention() -> None:
    service = ChatService(FakeRepository(), FakeOrderService(), Settings())  # type: ignore[arg-type]
    service.provider = SpoofingProvider()  # type: ignore[assignment]

    response = await service.answer_rag(uuid.uuid4(), "Return window?", [uuid.uuid4()])

    assert response.abstained is True
    assert response.answer == UNKNOWN_ANSWER
    assert response.citations == []
