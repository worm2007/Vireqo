from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, check_database_connection, engine, run_sqlite_compatibility_patches
from .middleware import (
    ApiRateLimitMiddleware,
    RequestIdMiddleware,
    RequestTimingMiddleware,
    SecurityHeadersMiddleware,
    install_exception_handlers,
)
from .routers import account, analytics, appointments, audit, auth, businesses, chatbot, conversations, leads, realtime, tasks, team
from .seed import seed_demo_data

API_VERSION = "0.5.0"


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.should_auto_create_tables:
        Base.metadata.create_all(bind=engine)
        run_sqlite_compatibility_patches()
    if settings.should_seed_demo_data:
        with SessionLocal() as db:
            seed_demo_data(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version=API_VERSION,
    description="Production-ready backend APIs for Vireqo: auth, CRM, AI workspace, analytics, tasks, privacy, real-time events and PostgreSQL deployment checks.",
    lifespan=lifespan,
)

install_exception_handlers(app)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(RequestTimingMiddleware)
app.add_middleware(ApiRateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Total-Count", "X-Request-ID", "X-RateLimit-Remaining"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(account.router, prefix="/api/v1")
app.include_router(businesses.router, prefix="/api/v1")
app.include_router(team.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1")
app.include_router(chatbot.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(realtime.router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "Vireqo API",
        "status": "online",
        "environment": settings.environment,
        "version": API_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "healthy",
        "environment": settings.environment,
        "version": API_VERSION,
        "database": "sqlite" if settings.is_sqlite else "postgresql",
        "rate_limit_enabled": settings.rate_limit_enabled,
    }


@app.get("/health/db", response_model=None)
def database_health():
    try:
        details = check_database_connection()
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "environment": settings.environment,
                "version": API_VERSION,
                "database": "sqlite" if settings.is_sqlite else "postgresql",
                "ok": False,
                "error": exc.__class__.__name__,
            },
        )

    return {
        "status": "ready",
        "environment": settings.environment,
        "version": API_VERSION,
        **details,
    }
