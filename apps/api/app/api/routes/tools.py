import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_owner_id
from app.core.config import Settings, get_settings
from app.core.errors import AppError, ToolUnavailableError
from app.db.database import get_session
from app.schemas.tools import (
    OrderStatusRequest,
    OrderStatusResponse,
    TicketConfirmRequest,
    TicketConfirmResponse,
    TicketPrepareRequest,
    TicketPrepareResponse,
)
from app.services.orders import OrderService
from app.services.tickets import TicketService

router = APIRouter(tags=["tools"])


@router.post("/tools/order-status", response_model=OrderStatusResponse)
async def order_status(
    request: OrderStatusRequest,
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
) -> OrderStatusResponse:
    try:
        return await OrderService(session).get_status(owner_id, request.order_number)
    except ToolUnavailableError as exc:
        raise AppError(
            "ORDER_TOOL_UNAVAILABLE", "Order status is temporarily unavailable.", 503
        ) from exc


@router.post("/tickets/prepare", response_model=TicketPrepareResponse, status_code=201)
async def prepare_ticket(
    request: TicketPrepareRequest,
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TicketPrepareResponse:
    return await TicketService(session, settings).prepare(owner_id, request)


@router.post("/tickets/confirm", response_model=TicketConfirmResponse, status_code=201)
async def confirm_ticket(
    request: TicketConfirmRequest,
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TicketConfirmResponse:
    return await TicketService(session, settings).confirm(
        owner_id, request.pending_action_id, request.confirmed
    )
