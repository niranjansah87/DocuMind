import time
from collections import defaultdict
from dataclasses import dataclass
from typing import ClassVar

from fastapi import Request

from app.core.config import Settings
from app.core.errors import AppError


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_after_seconds: int


class SlidingWindowRateLimiter:
    """In-memory sliding window rate limiter.

    Tracks request timestamps per client key with automatic window expiration
    and bounded memory overhead.
    """

    _instances: ClassVar[dict[str, list[float]]] = defaultdict(list)
    _last_cleanup: ClassVar[float] = 0.0

    @classmethod
    def check_rate_limit(
        cls, key: str, max_requests: int, window_seconds: int = 60
    ) -> RateLimitResult:
        now = time.monotonic()

        # Periodic cleanup of keys older than 2 * window_seconds (run at most once per 30s)
        if now - cls._last_cleanup > 30.0:
            cls._cleanup(now, window_seconds * 2)
            cls._last_cleanup = now

        timestamps = cls._instances[key]
        cutoff = now - window_seconds

        # Prune old timestamps in sliding window
        valid_timestamps = [ts for ts in timestamps if ts > cutoff]
        cls._instances[key] = valid_timestamps

        if len(valid_timestamps) >= max_requests:
            earliest = valid_timestamps[0]
            reset_after = max(1, int(window_seconds - (now - earliest)))
            return RateLimitResult(
                allowed=False,
                limit=max_requests,
                remaining=0,
                reset_after_seconds=reset_after,
            )

        valid_timestamps.append(now)
        return RateLimitResult(
            allowed=True,
            limit=max_requests,
            remaining=max_requests - len(valid_timestamps),
            reset_after_seconds=window_seconds,
        )

    @classmethod
    def _cleanup(cls, now: float, max_age: float) -> None:
        cutoff = now - max_age
        expired_keys = [
            k
            for k, timestamps in cls._instances.items()
            if not timestamps or timestamps[-1] < cutoff
        ]
        for k in expired_keys:
            del cls._instances[k]

    @classmethod
    def reset(cls) -> None:
        """Clear all rate limit state (primarily for test isolation)."""
        cls._instances.clear()
        cls._last_cleanup = 0.0


def get_client_identifier(request: Request) -> str:
    """Derive client rate-limiting identifier from auth token, forwarded header, or client host."""
    auth_header = request.headers.get("Authorization") or request.headers.get("X-API-Key")
    if auth_header:
        return f"auth:{hash(auth_header)}"

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
        return f"ip:{client_ip}"

    if request.client and request.client.host:
        return f"ip:{request.client.host}"

    return "anonymous"


def enforce_rate_limit(
    request: Request, limit: int, settings: Settings, window_seconds: int = 60
) -> RateLimitResult:
    """Evaluate and enforce rate limit for the current request.

    Raises AppError(429) if exceeded.
    """
    if not settings.rate_limit_enabled:
        return RateLimitResult(
            allowed=True, limit=limit, remaining=limit, reset_after_seconds=window_seconds
        )

    key = f"{get_client_identifier(request)}:{request.url.path}"
    result = SlidingWindowRateLimiter.check_rate_limit(key, limit, window_seconds)

    if not result.allowed:
        raise AppError(
            code="RATE_LIMIT_EXCEEDED",
            message=f"Rate limit exceeded. Try again in {result.reset_after_seconds} seconds.",
            status_code=429,
        )

    return result
