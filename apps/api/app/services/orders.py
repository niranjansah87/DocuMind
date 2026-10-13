import uuid

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ToolUnavailableError
from app.repositories.orders import OrderRepository
from app.schemas.tools import OrderStatusResponse


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.repository = OrderRepository(session)

    async def get_status(
        self, owner_id: uuid.UUID, order_number: str
    ) -> OrderStatusResponse:
        try:
            order = await self.repository.get_by_number(owner_id, order_number)
        except SQLAlchemyError as exc:
            raise ToolUnavailableError from exc
        if not order:
            return OrderStatusResponse(found=False, order_number=order_number)
        return OrderStatusResponse(
            found=True,
            order_number=order.order_number,
            status=order.status,
            items=order.items,
            updated_at=order.updated_at,
        )
