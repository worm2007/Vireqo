from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock

from fastapi import Request

from .config import settings


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int = 0
    remaining: int = 0


class FixedWindowRateLimiter:
    """Small in-process rate limiter for single-instance deployments.

    This protects local development and one-process Render/Railway style deploys.
    For multi-instance production, this should later be replaced by Redis-backed
    rate limiting so all instances share the same counters.
    """

    def __init__(self, *, limit: int, window_seconds: int, enabled: bool = True) -> None:
        self.limit = max(1, limit)
        self.window_seconds = max(1, window_seconds)
        self.enabled = enabled
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, *, increment: bool = True) -> RateLimitResult:
        if not self.enabled:
            return RateLimitResult(allowed=True, remaining=self.limit)

        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= self.limit:
                retry_after = max(1, int(self.window_seconds - (now - events[0])))
                return RateLimitResult(allowed=False, retry_after_seconds=retry_after, remaining=0)

            if increment:
                events.append(now)

            remaining = max(0, self.limit - len(events))
            return RateLimitResult(allowed=True, remaining=remaining)

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)


api_limiter = FixedWindowRateLimiter(
    limit=settings.api_rate_limit_max_requests,
    window_seconds=settings.api_rate_limit_window_seconds,
    enabled=settings.rate_limit_enabled,
)

auth_failure_limiter = FixedWindowRateLimiter(
    limit=settings.auth_rate_limit_max_attempts,
    window_seconds=settings.auth_rate_limit_window_seconds,
    enabled=settings.rate_limit_enabled,
)

auth_endpoint_limiter = FixedWindowRateLimiter(
    limit=settings.auth_endpoint_rate_limit_max_requests,
    window_seconds=settings.auth_endpoint_rate_limit_window_seconds,
    enabled=settings.rate_limit_enabled,
)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
