# Vireqo Security Hardening

Sprint 4.2 added the first production security layer; Sprint 4.5 adds production-readiness checks and safer local sharing rules.

## Included

- Request IDs on every response via `X-Request-ID`
- Basic response timing via `X-Response-Time-ms`
- Security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Strict-Transport-Security` in production
- General API rate limiting
- Auth endpoint rate limiting
- Login brute-force protection by IP, email and IP/email pair
- Safer production CORS validation in `deploy_check.py`
- Generic 500 errors in production while keeping detailed errors in development


## Sprint 4.5 additions

- Production deploy check now rejects SQLite, wildcard CORS, non-HTTPS public URLs, demo seeding and auto-create tables in production.
- `.gitignore` and `.dockerignore` now protect local databases, secrets, virtualenv files, caches and generated ZIPs.
- `scripts/create_backend_release_zip.py` creates a clean backend ZIP without `.env`, `.venv`, `vireqo.db`, caches or macOS metadata.
- `scripts/fix_demo_account.py` repairs older local demo users from `demo@vireqo.local` to `demo@vireqo.app`.

## Important limitation

The rate limiter is in-process. It is fine for local development and a single Render/Railway instance. When Vireqo moves to multiple backend instances, replace it with Redis-backed rate limiting.

## Recommended production values

```env
ENVIRONMENT=production
RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_MAX_REQUESTS=300
API_RATE_LIMIT_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_MAX_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_SECONDS=900
AUTH_ENDPOINT_RATE_LIMIT_MAX_REQUESTS=20
AUTH_ENDPOINT_RATE_LIMIT_WINDOW_SECONDS=300
```

## Local testing

Run:

```bash
python scripts/deploy_check.py
python -m compileall app scripts
python -m uvicorn app.main:app --reload --reload-dir app
```

Then open `/health` and confirm `rate_limit_enabled` is shown.
