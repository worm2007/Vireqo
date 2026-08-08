from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from app.config import settings
from app.database import database_kind, engine, safe_database_label

EXPECTED_TABLES = {
    "businesses",
    "users",
    "auth_tokens",
    "audit_logs",
    "leads",
    "conversations",
    "messages",
    "appointments",
    "tasks",
}


def fail(message: str) -> None:
    print(f"[postgres-smoke] ERROR: {message}")
    sys.exit(1)


def warn(message: str) -> None:
    print(f"[postgres-smoke] WARNING: {message}")


def ok(message: str) -> None:
    print(f"[postgres-smoke] OK: {message}")


def _alembic_head() -> str | None:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    return ScriptDirectory.from_config(cfg).get_current_head()


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify production PostgreSQL schema readiness for Vireqo.")
    parser.add_argument("--require-postgres", action="store_true", help="Fail unless DATABASE_URL points to PostgreSQL.")
    parser.add_argument("--allow-sqlite", action="store_true", help="Allow local SQLite checks for development only.")
    args = parser.parse_args()

    kind = database_kind()
    if args.require_postgres and kind != "postgresql":
        fail("DATABASE_URL must point to PostgreSQL for this check.")
    if kind == "sqlite" and not args.allow_sqlite:
        fail("SQLite detected. Use --allow-sqlite for local-only checks or configure PostgreSQL.")

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
        ok(f"connected target={safe_database_label()} kind={kind}")

        inspector = inspect(connection)
        tables = set(inspector.get_table_names())
        missing_tables = sorted(EXPECTED_TABLES - tables)
        if missing_tables:
            fail("missing tables after migration: " + ", ".join(missing_tables))
        ok(f"schema contains expected tables count={len(EXPECTED_TABLES)}")

        current_revision = None
        if "alembic_version" in tables:
            current_revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        else:
            message = "alembic_version table is missing. Run: alembic upgrade head"
            if kind == "postgresql" or args.require_postgres:
                fail(message)
            warn(message)

        head_revision = _alembic_head()
        if current_revision and head_revision and current_revision != head_revision:
            fail(f"database revision {current_revision} does not match Alembic head {head_revision}")
        if current_revision:
            ok(f"alembic revision current={current_revision}")

    if settings.should_auto_create_tables and kind == "postgresql":
        fail("AUTO_CREATE_TABLES must be disabled for PostgreSQL. Use Alembic migrations.")

    ok("production database smoke test passed")


if __name__ == "__main__":
    main()
