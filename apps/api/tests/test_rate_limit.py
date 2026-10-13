from unittest.mock import MagicMock

import pytest
from fastapi import Request

from app.core.config import Settings
from app.core.errors import AppError
from app.core.rate_limit import SlidingWindowRateLimiter, enforce_rate_limit


@pytest.fixture(autouse=True)
def reset_limiter() -> None:
    SlidingWindowRateLimiter.reset()


def make_mock_request(path: str = "/api/v1/chat", client_ip: str = "192.168.1.100") -> Request:
    request = MagicMock(spec=Request)
    request.url.path = path
    request.headers = {}
    request.client.host = client_ip
    return request


def test_sliding_window_allows_under_limit() -> None:
    for _ in range(5):
        result = SlidingWindowRateLimiter.check_rate_limit(
            "test-client", max_requests=5, window_seconds=60
        )
        assert result.allowed is True

    # 6th request should be blocked
    result = SlidingWindowRateLimiter.check_rate_limit(
        "test-client", max_requests=5, window_seconds=60
    )
    assert result.allowed is False
    assert result.remaining == 0
    assert result.reset_after_seconds > 0


def test_enforce_rate_limit_raises_429() -> None:
    request = make_mock_request("/api/v1/documents")
    settings = Settings(rate_limit_enabled=True)

    # Allow 2 requests
    enforce_rate_limit(request, limit=2, settings=settings, window_seconds=60)
    enforce_rate_limit(request, limit=2, settings=settings, window_seconds=60)

    # 3rd request must raise 429
    with pytest.raises(AppError) as exc_info:
        enforce_rate_limit(request, limit=2, settings=settings, window_seconds=60)

    assert exc_info.value.status_code == 429
    assert exc_info.value.code == "RATE_LIMIT_EXCEEDED"


def test_disabled_rate_limit_always_allows() -> None:
    request = make_mock_request("/api/v1/chat")
    settings = Settings(rate_limit_enabled=False)

    for _ in range(10):
        result = enforce_rate_limit(request, limit=1, settings=settings)
        assert result.allowed is True
