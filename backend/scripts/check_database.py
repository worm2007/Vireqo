from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.config import settings
from app.database import engine


if __name__ == "__main__":
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    print(f"Database connection OK: {'sqlite' if settings.is_sqlite else 'postgresql'}")
