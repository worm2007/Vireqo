from __future__ import annotations

import os
import sys
from urllib.parse import urlparse


def fail(message: str) -> None:
    print(f"[deploy-check] ERROR: {message}")
    sys.exit(1)


def warn(message: str) -> None:
    print(f"[deploy-check] WARNING: {message}")


def ok(message: str) -> None:
    print(f"[deploy-check] OK: {message}")


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> None:
    environment = os.getenv("ENVIRONMENT", "development").lower()
    secret_key = os.getenv("SECRET_KEY", "")
    database_url = os.getenv("DATABASE_URL", "")
    frontend_url = os.getenv("FRONTEND_URL", "")
    cors_origins = _csv(os.getenv("CORS_ORIGINS", ""))
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in {"1", "true", "yes", "on"}

    if environment in {"production", "prod"}:
        if not secret_key or secret_key == "dev-secret-change-before-production" or len(secret_key) < 32:
            fail("SECRET_KEY must be a strong unique value in production.")
        if not database_url:
            fail("DATABASE_URL is required in production.")
        if database_url.startswith("sqlite"):
            fail("Production must use PostgreSQL, not SQLite.")
        if not frontend_url:
            fail("FRONTEND_URL is required in production.")
        parsed_frontend = urlparse(frontend_url)
        if parsed_frontend.scheme != "https":
            fail("FRONTEND_URL must be HTTPS in production.")
        if any(origin == "*" for origin in cors_origins):
            fail("CORS_ORIGINS must not contain '*' in production.")
        for origin in cors_origins:
            parsed = urlparse(origin)
            if parsed.scheme != "https":
                fail(f"CORS origin must use HTTPS in production: {origin}")
        if not rate_limit_enabled:
            warn("RATE_LIMIT_ENABLED=false. This is not recommended in production.")
        if not groq_api_key:
            warn("GROQ_API_KEY is empty. AI features will be limited or fail.")

    ok(f"environment={environment}")
    ok(f"rate_limit_enabled={rate_limit_enabled}")
    ok("deployment configuration looks usable")


if __name__ == "__main__":
    main()
