from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def normalize_database_url(database_url: str) -> str:
    """Return a SQLAlchemy 2.x compatible database URL.

    Render/Railway-style URLs often arrive as postgres:// or postgresql://.
    The project uses psycopg v3, so explicit postgresql+psycopg:// keeps
    production installs free from a hidden psycopg2 dependency.
    """
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def database_kind(database_url: str | None = None) -> str:
    """Return a short public label for the configured database."""
    value = normalize_database_url(database_url or settings.database_url)
    if value.startswith("sqlite"):
        return "sqlite"
    if value.startswith(("postgresql", "postgres")):
        return "postgresql"
    return "unknown"


def safe_database_label(database_url: str | None = None) -> str:
    """Return a redacted database target label safe for logs and health output."""
    value = normalize_database_url(database_url or settings.database_url)
    try:
        parsed = make_url(value)
    except Exception:
        return database_kind(value)

    if parsed.drivername.startswith("sqlite"):
        return "sqlite"

    host = parsed.host or "configured-host"
    database = parsed.database or "configured-db"
    return f"{parsed.drivername}://{host}/{database}"


def create_database_engine(database_url: str | URL):
    if isinstance(database_url, str):
        database_url = normalize_database_url(database_url)
        connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    else:
        connect_args = {}
    return create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)


engine = create_database_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> dict[str, str | bool | int]:
    """Run a fast database readiness check.

    This is intentionally lightweight so it can be used by health checks and
    deployment scripts without triggering model imports or heavy queries.
    """
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
        inspector = inspect(connection)
        table_count = len(inspector.get_table_names())

    return {
        "ok": True,
        "kind": database_kind(),
        "target": safe_database_label(),
        "tables": table_count,
    }


def run_sqlite_compatibility_patches() -> None:
    """Apply tiny local-only SQLite upgrades for existing developer databases.

    Production databases should use Alembic. This keeps older local SQLite
    files from crashing after a nullable column is added to the ORM model.
    """
    if not settings.is_sqlite:
        return

    with engine.begin() as connection:
        inspector = inspect(connection)
        if "users" not in inspector.get_table_names():
            return
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "email_verified_at" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verified_at DATETIME"))
