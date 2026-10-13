import uuid

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.core.errors import AppError

DEMO_OWNER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_owner_id(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> uuid.UUID:
    """Resolve and enforce the authenticated tenant/owner ID for the request.

    - In production or when AUTH_REQUIRED=true: Validates API Key or Bearer token.
    - Honors X-Owner-Id or X-User-Id header if valid UUID for tenant isolation.
    - Falls back to DEMO_OWNER_ID in development/demo mode when unauthenticated.
    """
    auth_header = request.headers.get("Authorization") or ""
    api_key_header = request.headers.get("X-API-Key") or ""

    token: str | None = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif api_key_header:
        token = api_key_header.strip()

    if settings.auth_required:
        if not token:
            raise AppError("UNAUTHORIZED", "Missing authentication credentials.", 401)
        if settings.api_key and token != settings.api_key:
            raise AppError("FORBIDDEN", "Invalid authentication credentials.", 403)

    raw_owner = request.headers.get("X-Owner-Id") or request.headers.get("X-User-Id")
    if raw_owner:
        try:
            return uuid.UUID(raw_owner.strip())
        except ValueError:
            raise AppError(
                "INVALID_OWNER_ID", "Provided tenant identifier is not a valid UUID.", 400
            ) from None

    return DEMO_OWNER_ID
