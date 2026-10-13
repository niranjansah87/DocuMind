import uuid

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import ToolUnavailableError
from app.services.orders import OrderService


class FailingOrderRepository:
    async def get_by_number(self, owner_id: uuid.UUID, order_number: str) -> None:
        raise SQLAlchemyError("database unavailable")


@pytest.mark.asyncio
async def test_order_tool_failure_is_explicit() -> None:
    service = OrderService.__new__(OrderService)
    service.repository = FailingOrderRepository()  # type: ignore[assignment]

    with pytest.raises(ToolUnavailableError):
        await service.get_status(uuid.uuid4(), "ORD-1002")
