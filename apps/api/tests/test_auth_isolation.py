import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import Request

from app.api.dependencies import DEMO_OWNER_ID, get_owner_id
from app.core.config import Settings
from app.core.errors import AppError


def make_request(headers: dict[str, str] | None = None) -> Request:
    request = MagicMock(spec=Request)
    request.headers = headers or {}
    return request


def test_default_demo_owner_when_no_auth_required() -> None:
    request = make_request()
    settings = Settings(auth_required=False)
    resolved_id = get_owner_id(request, settings)
    assert resolved_id == DEMO_OWNER_ID


def test_custom_owner_id_header_respected() -> None:
    custom_id = uuid.uuid4()
    request = make_request({"X-Owner-Id": str(custom_id)})
    settings = Settings(auth_required=False)
    resolved_id = get_owner_id(request, settings)
    assert resolved_id == custom_id


def test_invalid_owner_id_header_rejected() -> None:
    request = make_request({"X-Owner-Id": "not-a-uuid"})
    settings = Settings(auth_required=False)
    with pytest.raises(AppError) as exc_info:
        get_owner_id(request, settings)
    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "INVALID_OWNER_ID"


def test_auth_required_blocks_unauthenticated() -> None:
    request = make_request()
    settings = Settings(auth_required=True, api_key="secret-prod-token")
    with pytest.raises(AppError) as exc_info:
        get_owner_id(request, settings)
    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "UNAUTHORIZED"


def test_auth_required_blocks_invalid_token() -> None:
    request = make_request({"Authorization": "Bearer wrong-token"})
    settings = Settings(auth_required=True, api_key="secret-prod-token")
    with pytest.raises(AppError) as exc_info:
        get_owner_id(request, settings)
    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_auth_required_accepts_valid_bearer_token() -> None:
    request = make_request({"Authorization": "Bearer secret-prod-token"})
    settings = Settings(auth_required=True, api_key="secret-prod-token")
    resolved_id = get_owner_id(request, settings)
    assert resolved_id == DEMO_OWNER_ID


def test_auth_required_accepts_valid_api_key_header() -> None:
    # With a single shared api_key, the only authorized tenant is default_tenant_id.
    # Providing a matching X-Owner-Id (DEMO_OWNER_ID) succeeds.
    request = make_request(
        {
            "X-API-Key": "secret-prod-token",
            "X-Owner-Id": str(DEMO_OWNER_ID),
        }
    )
    settings = Settings(auth_required=True, api_key="secret-prod-token")
    resolved_id = get_owner_id(request, settings)
    assert resolved_id == DEMO_OWNER_ID


def test_auth_verify_endpoint_default() -> None:
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.get("/api/v1/auth/verify")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["owner_id"] == str(DEMO_OWNER_ID)
    assert "auth_required" in data


def test_auth_verify_endpoint_with_tenant() -> None:
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    custom_tenant = str(uuid.uuid4())
    response = client.get("/api/v1/auth/verify", headers={"X-Owner-Id": custom_tenant})
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["owner_id"] == custom_tenant

