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

    - Server-side enforcement: Credentials deterministically establish tenant identity.
    - Multi-tenant isolation: When authenticated, X-Owner-Id must match authorized tenant;
      any mismatch is rejected with 403 FORBIDDEN to prevent tenant impersonation.
    - Production mode: Unauthenticated requests and impersonation attempts are blocked.
    - Local reviewer mode: Unauthenticated requests fall back to DEMO_OWNER_ID or requested tenant.
    """
    auth_header = request.headers.get("Authorization") or ""
    api_key_header = request.headers.get("X-API-Key") or ""

    token: str | None = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif api_key_header:
        token = api_key_header.strip()

    raw_owner = request.headers.get("X-Owner-Id") or request.headers.get("X-User-Id")
    requested_tenant: uuid.UUID | None = None
    if raw_owner:
        try:
            requested_tenant = uuid.UUID(raw_owner.strip())
        except ValueError:
            raise AppError(
                "INVALID_OWNER_ID", "Provided tenant identifier is not a valid UUID.", 400
            ) from None

    if settings.auth_required or settings.app_env.lower() == "production":
        if not token:
            raise AppError("UNAUTHORIZED", "Missing authentication credentials.", 401)

        authorized_tenant: uuid.UUID | None = None
        if token in settings.tenant_api_keys:
            authorized_tenant = settings.tenant_api_keys[token]
        elif settings.api_key and token == settings.api_key:
            authorized_tenant = settings.default_tenant_id
        else:
            raise AppError("FORBIDDEN", "Invalid authentication credentials.", 403)

        # Enforce that caller cannot impersonate another tenant
        if requested_tenant and requested_tenant != authorized_tenant:
            raise AppError(
                "FORBIDDEN",
                "Tenant impersonation forbidden: requested tenant does not match credential.",
                403,
            )

        return authorized_tenant

    # Non-production / Local Reviewer Mode (AUTH_REQUIRED=false)
    if token:
        if token in settings.tenant_api_keys:
            authorized_tenant = settings.tenant_api_keys[token]
            if requested_tenant and requested_tenant != authorized_tenant:
                raise AppError(
                    "FORBIDDEN",
                    "Tenant impersonation forbidden: requested tenant does not match credential.",
                    403,
                )
            return authorized_tenant
        if settings.api_key and token == settings.api_key:
            if requested_tenant:
                return requested_tenant
            return settings.default_tenant_id

    if requested_tenant:
        return requested_tenant

    return settings.default_tenant_id
