# Sprint 5.0 — Production PostgreSQL Verification

Sprint 5.0 is not a new product feature. It prepares the Vireqo backend to run safely on PostgreSQL in production.

## What changed

- Backend version bumped to `0.5.0`.
- `/health/db` added for database readiness checks.
- `scripts/wait_for_database.py` added for deployment startup reliability.
- `scripts/postgres_smoke_test.py` added for PostgreSQL schema verification.
- `scripts/render_start.sh` now validates environment, waits for the database, runs Alembic migrations, checks connectivity, and verifies PostgreSQL in production.
- `.env.production.example` added for production deployment values.
- Database helper functions now produce safe redacted database labels for logs.

## Local PostgreSQL test checklist

Start PostgreSQL, then set your backend `.env`:

```env
ENVIRONMENT=development
DATABASE_URL=postgresql+psycopg://vireqo:vireqo_dev_password@localhost:5432/vireqo
AUTO_CREATE_TABLES=false
SEED_DEMO_DATA=true
```

Run:

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
python scripts/postgres_smoke_test.py --require-postgres
python -m uvicorn app.main:app --reload --reload-dir app
```

Open:

```text
http://localhost:8000/health
http://localhost:8000/health/db
```

Expected:

```json
{
  "status": "ready",
  "database": "postgresql",
  "ok": true
}
```

## Production start command

```bash
bash scripts/render_start.sh
```

In production, this script fails fast when:

- `DATABASE_URL` is SQLite.
- `SECRET_KEY` is weak or missing.
- frontend/backend URLs are not HTTPS.
- `AUTO_CREATE_TABLES=true`.
- `SEED_DEMO_DATA=true`.
- PostgreSQL migrations are not at Alembic head.

## Important rule

Do not use `Base.metadata.create_all()` for production PostgreSQL. Production schema must be created and upgraded with Alembic:

```bash
alembic upgrade head
```
