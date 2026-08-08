#!/usr/bin/env bash
set -euo pipefail

# Render/Railway/Fly startup script.
# Validate configuration, wait for the database, run migrations, then start API.
python scripts/deploy_check.py
python scripts/wait_for_database.py --attempts "${DATABASE_WAIT_ATTEMPTS:-30}" --delay "${DATABASE_WAIT_DELAY:-2}"

alembic upgrade head
python scripts/check_database.py

if [[ "${ENVIRONMENT:-development}" == "production" || "${ENVIRONMENT:-development}" == "prod" ]]; then
  python scripts/postgres_smoke_test.py --require-postgres
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
