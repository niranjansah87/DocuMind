import pytest
from starlette.testclient import TestClient

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


def test_metrics_endpoint_returns_prometheus_format(client: TestClient) -> None:
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "documind_uptime_seconds" in response.text
    assert "documind_http_requests_total" in response.text
    assert response.headers.get("Cache-Control") == "no-store, no-cache, must-revalidate"

