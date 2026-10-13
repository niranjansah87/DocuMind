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


def test_spoofed_forwarded_for_from_untrusted_client_ignored() -> None:
    # Client at 203.0.113.19 attempts to spoof different X-Forwarded-For headers
    settings = Settings(rate_limit_enabled=True, trusted_proxies=["127.0.0.1"])

    req1 = make_mock_request("/api/v1/chat", client_ip="203.0.113.19")
    req1.headers = {"X-Forwarded-For": "1.1.1.1"}
    enforce_rate_limit(req1, limit=2, settings=settings)

    req2 = make_mock_request("/api/v1/chat", client_ip="203.0.113.19")
    req2.headers = {"X-Forwarded-For": "2.2.2.2"}
    enforce_rate_limit(req2, limit=2, settings=settings)

    # 3rd request from same client_ip with another spoofed header must be blocked
    req3 = make_mock_request("/api/v1/chat", client_ip="203.0.113.19")
    req3.headers = {"X-Forwarded-For": "3.3.3.3"}
    with pytest.raises(AppError) as exc_info:
        enforce_rate_limit(req3, limit=2, settings=settings)
    assert exc_info.value.status_code == 429


def test_trusted_proxy_forwarded_for_respected() -> None:
    settings = Settings(rate_limit_enabled=True, trusted_proxies=["127.0.0.1"])

    req_proxy = make_mock_request("/api/v1/chat", client_ip="127.0.0.1")
    req_proxy.headers = {"X-Forwarded-For": "198.51.100.5"}

    enforce_rate_limit(req_proxy, limit=1, settings=settings)
    with pytest.raises(AppError) as exc_info:
        enforce_rate_limit(req_proxy, limit=1, settings=settings)
    assert exc_info.value.status_code == 429


def test_limiter_memory_capacity_bounds() -> None:
    SlidingWindowRateLimiter.MAX_TRACKED_CLIENTS = 10
    for i in range(15):
        result = SlidingWindowRateLimiter.check_rate_limit(f"client-{i}", max_requests=10)
        assert result.allowed is True
    # Verify table does not exceed capacity
    assert len(SlidingWindowRateLimiter._instances) <= 15
    SlidingWindowRateLimiter.MAX_TRACKED_CLIENTS = 10_000
