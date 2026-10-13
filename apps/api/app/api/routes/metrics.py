from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import metrics
from app.db.database import get_session

router = APIRouter(tags=["observability"])


@router.get("/metrics")
async def get_metrics(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Prometheus operational metrics endpoint."""
    db_healthy = True
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_healthy = False

    accept = request.headers.get("Accept", "")
    if "application/json" in accept:
        return Response(
            content=str(metrics.to_dict(db_healthy=db_healthy)),
            media_type="application/json",
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    return Response(
        content=metrics.to_prometheus(db_healthy=db_healthy),
        media_type="text/plain; version=0.0.4; charset=utf-8",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )
