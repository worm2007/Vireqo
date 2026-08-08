# Vireqo Security Notes

## Current production safeguards
- FastAPI backend with JWT access tokens and refresh tokens.
- Password hashing.
- Production CORS allowlist.
- Rate limiting middleware.
- Request ID and timing middleware.
- Security headers.
- PostgreSQL database for production.
- Workspace export and owner-only workspace deletion controls.

## Still pending
- Real email delivery for password reset and verification.
- Sentry or equivalent error tracking.
- Uptime monitoring.
- Redis-backed rate limiting for multi-instance deployments.
- Database backup policy.
- Billing and usage limit enforcement.
