from __future__ import annotations

import logging
import secrets
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from .config import settings
from .rate_limit import api_limiter, get_client_ip

logger = logging.getLogger("vireqo.security")


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or secrets.token_hex(12)
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(self), geolocation=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


class ApiRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.rate_limit_enabled or request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        should_limit = path.startswith("/api/v1") and not path.startswith("/api/v1/realtime")
        if not should_limit:
            return await call_next(request)

        client_ip = get_client_ip(request)
        key = f"api:{client_ip}"
        result = api_limiter.check(key)
        if not result.allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please wait and try again."},
                headers={"Retry-After": str(result.retry_after_seconds)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        return response


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - started) * 1000)
        response.headers["X-Response-Time-ms"] = str(duration_ms)
        return response


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        logger.exception("Unhandled server error request_id=%s path=%s", request_id, request.url.path)
        detail = "Internal server error"
        if settings.is_development:
            detail = f"{exc.__class__.__name__}: {exc}"
        return JSONResponse(
            status_code=500,
            content={"detail": detail, "request_id": request_id},
        )
