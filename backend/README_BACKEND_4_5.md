# Sprint 4.5 Backend Stability Cleanup

This sprint is intentionally small. It does not add a new product module. It cleans the backend so Vireqo is safer to test, share and deploy.

## Included

- API version bumped to `0.4.5`.
- Demo seeding now repairs old `demo@vireqo.local` users to `demo@vireqo.app`.
- New `scripts/fix_demo_account.py` helper for stale local SQLite databases.
- New `scripts/create_backend_release_zip.py` helper for clean backend ZIPs.
- Stronger `scripts/deploy_check.py` production validation.
- Backend `.gitignore` added.
- `.dockerignore` tightened.
- `.env.example` updated with all important Sprint 4.x backend settings.
- Deployment and security docs updated.

## Local cleanup commands

```bash
cd "/Users/dikshatiwari/Desktop/Vireqo/backend"
source .venv/bin/activate
python scripts/fix_demo_account.py
python -m compileall app scripts tests
pytest -q
```

## Create a clean backend ZIP

```bash
cd "/Users/dikshatiwari/Desktop/Vireqo/backend"
source .venv/bin/activate
python scripts/create_backend_release_zip.py
```

The generated ZIP will be saved in:

```text
backend/release/Vireqo-Backend-Clean-Release.zip
```

It excludes `.env`, `.venv`, local database files, caches, macOS metadata and generated ZIPs.
