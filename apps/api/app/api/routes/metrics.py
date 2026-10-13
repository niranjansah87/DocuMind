import json

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.metrics import metrics
from app.db.database import get_session

router = APIRouter(tags=["observability"])


@router.get("/metrics")
async def get_metrics(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Prometheus operational metrics endpoint."""
    if settings.metrics_token or settings.auth_required:
        auth_header = request.headers.get("Authorization") or ""
        token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
        metrics_key = request.headers.get("X-Metrics-Key") or request.headers.get("X-API-Key")
        caller_token = token or metrics_key or ""

        if settings.metrics_token:
            if caller_token != settings.metrics_token:
                raise AppError("UNAUTHORIZED", "Invalid or missing metrics token.", 401)
        elif settings.auth_required:
            valid_keys = set(settings.tenant_api_keys.keys())
            if settings.api_key:
                valid_keys.add(settings.api_key)
            if not caller_token or caller_token not in valid_keys:
                raise AppError("UNAUTHORIZED", "Metrics access requires authorization.", 401)

    db_healthy = True
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_healthy = False

    accept = request.headers.get("Accept", "")
    if "application/json" in accept:
        return Response(
            content=json.dumps(metrics.to_dict(db_healthy=db_healthy)),
            media_type="application/json",
            headers={"Cache-Control": "no-store, no-cache, must-revalidate, private"},
        )

    return Response(
        content=metrics.to_prometheus(db_healthy=db_healthy),
        media_type="text/plain; version=0.0.4; charset=utf-8",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, private"},
    )
