from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Vireqo API")
    environment: str = os.getenv("ENVIRONMENT", "development")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-before-production")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./vireqo.db")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "1440"))


settings = Settings()
