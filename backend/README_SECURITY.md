# Vireqo Security Hardening

Sprint 4.2 adds the first production security layer for the backend.

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
