from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import check_database_connection, safe_database_label


def main() -> None:
    parser = argparse.ArgumentParser(description="Wait until Vireqo can connect to the configured database.")
    parser.add_argument("--attempts", type=int, default=30)
    parser.add_argument("--delay", type=float, default=2.0)
    args = parser.parse_args()

    last_error = ""
    for attempt in range(1, args.attempts + 1):
        try:
            details = check_database_connection()
            print(
                "[database-wait] OK "
                f"kind={details['kind']} target={details['target']} tables={details['tables']}"
            )
            return
        except Exception as exc:  # pragma: no cover - used in deployment runtime
            last_error = f"{exc.__class__.__name__}: {exc}"
            print(
                "[database-wait] waiting "
                f"attempt={attempt}/{args.attempts} target={safe_database_label()} error={last_error}"
            )
            time.sleep(args.delay)

    print(f"[database-wait] ERROR database unavailable after {args.attempts} attempts: {last_error}")
    sys.exit(1)


if __name__ == "__main__":
    main()
