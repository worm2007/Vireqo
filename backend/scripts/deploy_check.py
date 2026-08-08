from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

PLACEHOLDER_SECRET = "dev-secret-change-before-production"


def fail(message: str) -> None:
    print(f"[deploy-check] ERROR: {message}")
    sys.exit(1)


def warn(message: str) -> None:
    print(f"[deploy-check] WARNING: {message}")


def ok(message: str) -> None:
    print(f"[deploy-check] OK: {message}")


def _csv(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _require_https(name: str, value: str) -> None:
    if not value:
        fail(f"{name} is required in production.")
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        fail(f"{name} must be a valid HTTPS URL in production.")


def main() -> None:
    environment = os.getenv("ENVIRONMENT", "development").lower()
    secret_key = os.getenv("SECRET_KEY", "")
    database_url = os.getenv("DATABASE_URL", "")
    frontend_url = os.getenv("FRONTEND_URL", "")
    backend_public_url = os.getenv("BACKEND_PUBLIC_URL", "")
    cors_origins = _csv(os.getenv("CORS_ORIGINS", ""))
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    rate_limit_enabled = _env_bool("RATE_LIMIT_ENABLED", True)
    auto_create_tables = _env_bool("AUTO_CREATE_TABLES", False)
    seed_demo_data = _env_bool("SEED_DEMO_DATA", False)
    require_email_verification = _env_bool("REQUIRE_EMAIL_VERIFICATION", False)
    resend_api_key = os.getenv("RESEND_API_KEY", "")
    email_from = os.getenv("EMAIL_FROM", "")

    if environment in {"production", "prod"}:
        if not secret_key or secret_key == PLACEHOLDER_SECRET or len(secret_key) < 32:
            fail("SECRET_KEY must be a strong unique value of at least 32 characters in production.")
        if not database_url:
            fail("DATABASE_URL is required in production.")
        if database_url.startswith("sqlite"):
            fail("Production must use PostgreSQL, not SQLite.")
        if not database_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
            fail("DATABASE_URL must be a PostgreSQL URL in production.")
        if not (Path("alembic.ini").exists() and Path("alembic").exists()):
            fail("Alembic files are missing. Production database migrations cannot run.")

        _require_https("FRONTEND_URL", frontend_url)
        _require_https("BACKEND_PUBLIC_URL", backend_public_url)

        if any(origin == "*" for origin in cors_origins):
            fail("CORS_ORIGINS must not contain '*' in production.")
        for origin in cors_origins:
            _require_https("CORS_ORIGINS entry", origin)

        if auto_create_tables:
            fail("AUTO_CREATE_TABLES must be false in production. Use Alembic migrations instead.")
        if seed_demo_data:
            fail("SEED_DEMO_DATA must be false in production.")
        if not rate_limit_enabled:
            warn("RATE_LIMIT_ENABLED=false. This is not recommended in production.")
        if not resend_api_key or not email_from:
            if require_email_verification:
                fail("RESEND_API_KEY and EMAIL_FROM are required when REQUIRE_EMAIL_VERIFICATION=true.")
            warn("RESEND_API_KEY or EMAIL_FROM is empty. Password reset and verification emails will not send.")
        if not require_email_verification:
            warn("REQUIRE_EMAIL_VERIFICATION=false. Enable it after Resend email delivery is tested.")
        if not groq_api_key:
            warn("GROQ_API_KEY is empty. AI features will be limited or fail.")

    ok(f"environment={environment}")
    ok(f"rate_limit_enabled={rate_limit_enabled}")
    ok("deployment configuration looks usable")


if __name__ == "__main__":
    main()
