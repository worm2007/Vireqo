# Vireqo Auth Recovery

Sprint 4.3 adds production-style account recovery and email verification.

## Password reset

- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

In local development, when `RESEND_API_KEY` is empty, the forgot-password response includes a local `reset_url` so the flow can be tested without real email sending.

## Email verification

- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/verify-email`

New workspaces receive an email-verification token during registration. In local development, when `RESEND_API_KEY` is empty, the registration response includes a local verification URL.

## Production settings

```env
FRONTEND_URL=https://your-frontend.vercel.app
RESEND_API_KEY=your_resend_key
EMAIL_FROM=Vireqo <noreply@your-domain.com>
EMAIL_VERIFICATION_HOURS=24
REQUIRE_EMAIL_VERIFICATION=true
```

Keep `REQUIRE_EMAIL_VERIFICATION=false` until real email delivery is configured and tested.

## Database

PostgreSQL production databases should run:

```bash
alembic upgrade head
```

Local SQLite development databases get a small compatibility patch at startup so old local databases do not crash when `email_verified_at` is added.
