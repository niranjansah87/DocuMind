import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Order


class OrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_number(
        self, owner_id: uuid.UUID, order_number: str
    ) -> Order | None:
        result = await self.session.execute(
            select(Order).where(
                Order.owner_id == owner_id, Order.order_number == order_number
            )
        )
        return result.scalar_one_or_none()
