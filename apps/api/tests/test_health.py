from fastapi.testclient import TestClient

from app.main import app


def test_health_is_independent_of_database() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"]


def test_landing_page_renders_html() -> None:
    response = TestClient(app).get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "DocuMind Intelligence API" in response.text
    assert "/docs" in response.text
    assert response.headers["x-request-id"]
