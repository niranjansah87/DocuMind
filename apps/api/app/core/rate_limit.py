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
    MAX_TRACKED_CLIENTS: ClassVar[int] = 10_000

    @classmethod
    def check_rate_limit(
        cls, key: str, max_requests: int, window_seconds: int = 60
    ) -> RateLimitResult:
        now = time.monotonic()

        # Prevent unbounded memory growth under spoofed-key DoS attacks
        if key not in cls._instances and len(cls._instances) >= cls.MAX_TRACKED_CLIENTS:
            cls._cleanup(now, float(window_seconds))
            if len(cls._instances) >= cls.MAX_TRACKED_CLIENTS:
                # Evict oldest 1,000 entries
                oldest_keys = sorted(
                    cls._instances.keys(),
                    key=lambda k: cls._instances[k][-1] if cls._instances[k] else 0,
                )[:1000]
                for old_k in oldest_keys:
                    cls._instances.pop(old_k, None)

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


def get_client_identifier(request: Request, settings: Settings | None = None) -> str:
    """Derive client rate-limiting identifier from auth token, verified proxy header, or peer IP.

    Guards against X-Forwarded-For header spoofing by only honoring forward headers
    when the direct socket peer is an explicitly configured trusted proxy.
    """
    import hashlib

    auth_header = request.headers.get("Authorization") or request.headers.get("X-API-Key")
    if auth_header:
        token_hash = hashlib.sha256(auth_header.encode()).hexdigest()[:16]
        return f"auth:{token_hash}"

    peer_ip = request.client.host if request.client else ""
    trusted = settings.trusted_proxies if settings else ["127.0.0.1", "::1", "localhost"]

    # Only honor X-Forwarded-For if socket peer is in trusted_proxies list
    if peer_ip and peer_ip in trusted:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
            return f"ip:{client_ip}"

    if peer_ip:
        return f"ip:{peer_ip}"

    return "anonymous"


def enforce_rate_limit(
    request: Request, limit: int, settings: Settings, window_seconds: int = 60
) -> RateLimitResult:
    """Evaluate and enforce rate limit for the current request."""
    client_id = get_client_identifier(request, settings)

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
