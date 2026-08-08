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


def main() -> None:
    environment = os.getenv("ENVIRONMENT", "development").lower()
    secret_key = os.getenv("SECRET_KEY", "")
    database_url = os.getenv("DATABASE_URL", "")
    frontend_url = os.getenv("FRONTEND_URL", "")
    groq_api_key = os.getenv("GROQ_API_KEY", "")

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
            warn("FRONTEND_URL should be HTTPS in production.")
        if not groq_api_key:
            warn("GROQ_API_KEY is empty. AI features will be limited or fail.")

    ok(f"environment={environment}")
    ok("deployment configuration looks usable")


if __name__ == "__main__":
    main()
