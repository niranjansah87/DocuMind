import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.api.dependencies import DEMO_OWNER_ID
from app.core.config import Settings
from app.core.errors import AppError, ProviderUnavailableError
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.services.ingestion import IngestionService
from app.services.tickets import TicketService


class DuplicateRepository:
    def __init__(self) -> None:
        self.document = SimpleNamespace(
            id=uuid.uuid4(),
            filename="policy.txt",
            status="ready",
        )

    async def find_duplicate(self, owner_id: uuid.UUID, content_hash: str) -> object:
        assert owner_id == DEMO_OWNER_ID
        assert len(content_hash) == 64
        return self.document

    async def count_chunks(self, document_id: uuid.UUID) -> int:
        assert document_id == self.document.id
        return 3


@pytest.mark.asyncio
async def test_duplicate_upload_reuses_document_without_provider_call() -> None:
    service = IngestionService.__new__(IngestionService)
    service.settings = Settings()
    service.repository = DuplicateRepository()  # type: ignore[assignment]

    result = await service.ingest(
        DEMO_OWNER_ID, "policy.txt", "text/plain", b"policy text"
    )

    assert result.duplicate is True
    assert result.chunk_count == 3


class FakeTicketRepository:
    def __init__(self, action: object) -> None:
        self.action = action

    async def lock_pending(self, owner_id: uuid.UUID, pending_id: uuid.UUID) -> object:
        return self.action


@pytest.mark.asyncio
async def test_ticket_confirmation_replay_is_rejected() -> None:
    pending_id = uuid.uuid4()
    action = SimpleNamespace(
        id=pending_id,
        action_type="create_ticket",
        confirmation_token_hash=__import__("hashlib")
        .sha256(str(pending_id).encode())
        .hexdigest(),
        consumed_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )
    service = TicketService.__new__(TicketService)
    service.tickets = FakeTicketRepository(action)  # type: ignore[assignment]

    with pytest.raises(AppError) as error:
        await service.confirm(DEMO_OWNER_ID, pending_id, True)

    assert error.value.code == "CONFIRMATION_ALREADY_USED"


class FallbackProvider(OpenAICompatibleProvider):
    def __init__(self) -> None:
        super().__init__(Settings(llm_model="primary", llm_fallback_model="fallback"))
        self.models: list[str] = []

    async def _post(self, path: str, payload: dict[str, object]) -> dict[str, object]:
        self.models.append(str(payload["model"]))
        if payload["model"] == "primary":
            raise ProviderUnavailableError()
        return {"choices": [{"message": {"content": "{}"}}]}


@pytest.mark.asyncio
async def test_generation_uses_configured_fallback() -> None:
    provider = FallbackProvider()

    result = await provider.generate([{"role": "user", "content": "question"}])

    assert result == "{}"
    assert provider.models == ["primary", "fallback"]
