# Backend Deployment

Sprint 5.0 prepares the Vireqo backend for PostgreSQL-backed production deployment.

## Required production environment variables

Use `.env.production.example` as the template.

```env
ENVIRONMENT=production
SECRET_KEY=<strong-random-value-at-least-32-characters>
DATABASE_URL=<postgresql-url>
FRONTEND_URL=https://app.vireqo.in
BACKEND_PUBLIC_URL=https://api.vireqo.in
CORS_ORIGINS=https://app.vireqo.in
GROQ_API_KEY=<needed-for-ai-features>
AUTO_CREATE_TABLES=false
SEED_DEMO_DATA=false
REQUIRE_EMAIL_VERIFICATION=true
RATE_LIMIT_ENABLED=true
```

## Start command

```bash
bash scripts/render_start.sh
```

The start script now runs this sequence:

1. `python scripts/deploy_check.py`
2. wait for database connection
3. `alembic upgrade head`
4. database connectivity check
5. PostgreSQL schema smoke test in production
6. start Uvicorn

## Health checks

General health:

```text
/health
```

Expected:

```json
{
  "status": "healthy",
  "environment": "production",
  "version": "0.5.0",
  "database": "postgresql",
  "rate_limit_enabled": true
}
```

Database readiness:

```text
/health/db
```

Expected:

```json
{
  "status": "ready",
  "environment": "production",
  "version": "0.5.0",
  "ok": true,
  "kind": "postgresql"
}
```

## Local production-style check

```bash
cd backend
source .venv/bin/activate
ENVIRONMENT=production \
SECRET_KEY=replace-with-a-strong-32-character-secret \
DATABASE_URL=postgresql://user:pass@localhost:5432/vireqo \
FRONTEND_URL=https://app.vireqo.in \
BACKEND_PUBLIC_URL=https://api.vireqo.in \
CORS_ORIGINS=https://app.vireqo.in \
AUTO_CREATE_TABLES=false \
SEED_DEMO_DATA=false \
REQUIRE_EMAIL_VERIFICATION=true \
python scripts/deploy_check.py
```

## PostgreSQL smoke test

```bash
python scripts/postgres_smoke_test.py --require-postgres
```

This verifies connection, required tables, and Alembic revision alignment.

## Clean backend ZIP

Never share a ZIP that contains `.env`, `.venv`, `vireqo.db`, caches or macOS metadata. Create a clean backend release with:

```bash
python scripts/create_backend_release_zip.py
```
