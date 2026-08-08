from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import check_database_connection


if __name__ == "__main__":
    details = check_database_connection()
    print(
        "Database connection OK: "
        f"kind={details['kind']} target={details['target']} tables={details['tables']}"
    )
