#!/usr/bin/env bash
set -euo pipefail

# Render/Railway/Fly startup script.
# Run migrations before the API starts so production schema stays in sync.
alembic upgrade head
python scripts/check_database.py

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
