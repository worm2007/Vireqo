from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import analytics, appointments, audit, auth, businesses, chatbot, conversations, leads, realtime, tasks, team
from .seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.should_auto_create_tables:
        Base.metadata.create_all(bind=engine)
    if settings.should_seed_demo_data:
        with SessionLocal() as db:
            seed_demo_data(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.3.0",
    description="Authentication, CRM, conversations, appointments and analytics APIs for Vireqo.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

app.include_router(auth.router, prefix="/api/v1")
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
    return {"name": "Vireqo API", "status": "online", "version": "0.3.0", "docs": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "environment": settings.environment, "version": "0.3.0", "database": "sqlite" if settings.is_sqlite else "postgresql"}
