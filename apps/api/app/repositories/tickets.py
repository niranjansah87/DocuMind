import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PendingAction, SupportTicket


class TicketRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_pending(
        self, owner_id: uuid.UUID, pending_id: uuid.UUID
    ) -> PendingAction | None:
        result = await self.session.execute(
            select(PendingAction)
            .where(PendingAction.id == pending_id, PendingAction.owner_id == owner_id)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def find_ticket(self, owner_id: uuid.UUID, idempotency_key: str) -> SupportTicket | None:
        result = await self.session.execute(
            select(SupportTicket).where(
                SupportTicket.owner_id == owner_id,
                SupportTicket.idempotency_key == idempotency_key,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    def is_expired(action: PendingAction) -> bool:
        return action.expires_at <= datetime.now(UTC)
