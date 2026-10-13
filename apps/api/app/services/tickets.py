import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import PendingAction, SupportTicket
from app.repositories.orders import OrderRepository
from app.repositories.tickets import TicketRepository
from app.schemas.tools import (
    TicketConfirmResponse,
    TicketPrepareRequest,
    TicketPrepareResponse,
)


class TicketService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.orders = OrderRepository(session)
        self.tickets = TicketRepository(session)

    async def prepare(
        self, owner_id: uuid.UUID, request: TicketPrepareRequest
    ) -> TicketPrepareResponse:
        if request.order_number and not await self.orders.get_by_number(
            owner_id, request.order_number
        ):
            raise AppError("ORDER_NOT_FOUND", f"Order {request.order_number} was not found.", 404)
        pending_id = uuid.uuid4()
        expires_at = datetime.now(UTC) + timedelta(
            seconds=self.settings.ticket_confirmation_ttl_seconds
        )
        payload = request.model_dump()
        action = PendingAction(
            id=pending_id,
            owner_id=owner_id,
            action_type="create_ticket",
            payload=payload,
            confirmation_token_hash=hashlib.sha256(str(pending_id).encode()).hexdigest(),
            expires_at=expires_at,
        )
        self.session.add(action)
        await self.session.commit()
        suffix = f" for {request.order_number}" if request.order_number else ""
        return TicketPrepareResponse(
            pending_action_id=pending_id,
            summary=f"Create a ticket titled '{request.subject}'{suffix}.",
            expires_at=expires_at,
        )

    async def confirm(
        self, owner_id: uuid.UUID, pending_id: uuid.UUID, confirmed: bool
    ) -> TicketConfirmResponse:
        if not confirmed:
            raise AppError(
                "CONFIRMATION_REQUIRED",
                "Ticket creation requires explicit confirmation.",
                409,
            )
        action = await self.tickets.lock_pending(owner_id, pending_id)
        if not action or action.action_type != "create_ticket":
            raise AppError(
                "PENDING_ACTION_NOT_FOUND",
                "The pending ticket action was not found.",
                404,
            )
        expected_hash = hashlib.sha256(str(action.id).encode()).hexdigest()
        if action.confirmation_token_hash != expected_hash:
            raise AppError("CONFIRMATION_INVALID", "The ticket confirmation is invalid.", 409)
        idempotency_key = str(action.id)
        if action.consumed_at:
            raise AppError(
                "CONFIRMATION_ALREADY_USED",
                "The ticket confirmation was already used.",
                409,
            )
        if self.tickets.is_expired(action):
            raise AppError("CONFIRMATION_EXPIRED", "The ticket confirmation has expired.", 409)
        existing = await self.tickets.find_ticket(owner_id, idempotency_key)
        if existing:
            raise AppError(
                "CONFIRMATION_ALREADY_USED",
                "The ticket confirmation was already used.",
                409,
            )
        order_number = action.payload.get("order_number")
        order = (
            await self.orders.get_by_number(owner_id, order_number)
            if isinstance(order_number, str)
            else None
        )
        ticket_id = uuid.uuid4()
        ticket = SupportTicket(
            id=ticket_id,
            ticket_number=f"TKT-{ticket_id.hex[:8].upper()}",
            owner_id=owner_id,
            order_id=order.id if order else None,
            subject=action.payload["subject"],
            description=action.payload["description"],
            idempotency_key=idempotency_key,
        )
        action.consumed_at = datetime.now(UTC)
        self.session.add(ticket)
        await self.session.commit()
        return self._response(ticket)

    @staticmethod
    def _response(ticket: SupportTicket) -> TicketConfirmResponse:
        return TicketConfirmResponse(
            created=True,
            ticket_id=ticket.id,
            ticket_number=ticket.ticket_number,
            status=ticket.status,
        )
