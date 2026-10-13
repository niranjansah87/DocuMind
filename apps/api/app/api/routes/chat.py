import json
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.router import route_message
from app.api.dependencies import get_owner_id
from app.core.config import Settings, get_settings
from app.db.database import get_session
from app.repositories.documents import DocumentRepository
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat import ChatService
from app.services.orders import OrderService

router = APIRouter(tags=["chat"])


def event(name: str, payload: object) -> str:
    return f"event: {name}\ndata: {json.dumps(payload, default=str)}\n\n"


async def stream_response(response: ChatResponse) -> AsyncIterator[str]:
    yield event("status", {"route": response.route, "stage": "answering"})
    yield event("token", {"text": response.answer})
    yield event("citations", [citation.model_dump() for citation in response.citations])
    yield event("done", {"route": response.route, "abstained": response.abstained, "latency_ms": response.latency_ms})


@router.post("/chat", response_class=StreamingResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    decision = route_message(payload.message)
    service = ChatService(DocumentRepository(session), OrderService(session), settings)
    if decision.route == "order" and decision.order_number:
        response = await service.answer_order(owner_id, decision.order_number)
        content = stream_response(response)
    else:
        async def rag_events() -> AsyncIterator[str]:
            try:
                async for name, data in service.stream_rag(
                    owner_id, payload.message, payload.document_ids
                ):
                    if await request.is_disconnected():
                        return
                    yield event(name, data)
            except Exception:
                yield event(
                    "error",
                    {
                        "code": "ANSWER_UNAVAILABLE",
                        "message": "The answer service is temporarily unavailable.",
                        "request_id": request.state.request_id,
                    },
                )

        content = rag_events()
    return StreamingResponse(
        content,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
