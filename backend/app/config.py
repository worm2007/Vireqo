from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _split_csv(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Vireqo API")
    environment: str = os.getenv("ENVIRONMENT", "development")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-before-production")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./vireqo.db")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    backend_public_url: str = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000").rstrip("/")
    cors_origins: str = os.getenv("CORS_ORIGINS", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    access_token_minutes: int = _env_int("ACCESS_TOKEN_MINUTES", 30)
    refresh_token_days: int = _env_int("REFRESH_TOKEN_DAYS", 30)
    password_reset_minutes: int = _env_int("PASSWORD_RESET_MINUTES", 30)
    email_verification_hours: int = _env_int("EMAIL_VERIFICATION_HOURS", 24)
    require_email_verification: bool = _env_bool("REQUIRE_EMAIL_VERIFICATION", False)
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    email_from: str = os.getenv("EMAIL_FROM", "Vireqo <onboarding@resend.dev>")

    # SQLite can auto-create tables during local development for fast onboarding.
    # PostgreSQL/production should use Alembic migrations instead.
    auto_create_tables_env: str = os.getenv("AUTO_CREATE_TABLES", "")
    seed_demo_data_env: str = os.getenv("SEED_DEMO_DATA", "")

    # Security / abuse protection. These are in-process limits; use Redis later
    # when running multiple backend instances.
    rate_limit_enabled: bool = _env_bool("RATE_LIMIT_ENABLED", True)
    api_rate_limit_max_requests: int = _env_int("API_RATE_LIMIT_MAX_REQUESTS", 300)
    api_rate_limit_window_seconds: int = _env_int("API_RATE_LIMIT_WINDOW_SECONDS", 60)
    auth_rate_limit_max_attempts: int = _env_int("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 5)
    auth_rate_limit_window_seconds: int = _env_int("AUTH_RATE_LIMIT_WINDOW_SECONDS", 900)
    auth_endpoint_rate_limit_max_requests: int = _env_int("AUTH_ENDPOINT_RATE_LIMIT_MAX_REQUESTS", 20)
    auth_endpoint_rate_limit_window_seconds: int = _env_int("AUTH_ENDPOINT_RATE_LIMIT_WINDOW_SECONDS", 300)

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local", "test"}

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.frontend_url, "http://127.0.0.1:3000"]
        origins.extend(_split_csv(self.cors_origins))
        origins = list(dict.fromkeys(origin for origin in origins if origin))
        if self.is_production:
            return [origin for origin in origins if origin != "*" and origin.startswith("https://")]
        return origins

    @property
    def should_auto_create_tables(self) -> bool:
        if self.auto_create_tables_env.strip():
            return _env_bool("AUTO_CREATE_TABLES", False)
        return self.is_development and self.is_sqlite

    @property
    def should_seed_demo_data(self) -> bool:
        if self.seed_demo_data_env.strip():
            return _env_bool("SEED_DEMO_DATA", False)
        return self.is_development


settings = Settings()
