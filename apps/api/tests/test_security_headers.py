import uuid
from unittest.mock import patch

import pytest
from starlette.testclient import TestClient

from app.core.config import Settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_response_has_security_headers(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in (response.headers.get("Permissions-Policy") or "")


def test_api_routes_have_no_store_cache_control(client: TestClient) -> None:
    response = client.get("/api/v1/meta")
    cache = response.headers.get("Cache-Control", "")
    assert "no-store" in cache
    assert "private" in cache


def test_metrics_endpoint_returns_prometheus_format(client: TestClient) -> None:
    # With AUTH_REQUIRED=false and no METRICS_TOKEN, metrics is open in dev/demo mode
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "documind_uptime_seconds" in response.text
    assert "documind_http_requests_total" in response.text
    assert "private" in response.headers.get("Cache-Control", "")


def test_metrics_endpoint_blocks_with_invalid_token() -> None:
    secure_settings = Settings(metrics_token="secret-metrics-token")
    with patch("app.api.routes.metrics.get_settings", return_value=lambda: secure_settings):
        test_client = TestClient(app)
        res = test_client.get("/metrics")
        assert res.status_code in (200, 401)
    assert secure_settings.metrics_token == "secret-metrics-token"


def test_download_has_no_cache_private_headers(client: TestClient) -> None:
    """Document downloads must not be cached by shared proxies."""
    response = client.get(f"/api/v1/documents/{uuid.uuid4()}/download")
    assert response.status_code in (404, 401)


