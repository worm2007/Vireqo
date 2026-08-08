# Vireqo Sprint 6.0 — Email System

Sprint 6.0 adds production-ready transactional email support for Vireqo auth flows.

## What is included

- Branded Vireqo verification emails
- Branded password reset emails
- HTML + plain-text email bodies
- Resend API integration
- Reply-to/support email configuration
- Email logo URL configuration
- Idempotency keys for auth emails
- Production deploy checks for email configuration
- Email-verification gate for protected API routes when enabled

## Required production environment variables

```env
RESEND_API_KEY=re_xxx
EMAIL_FROM=Vireqo <hello@vireqo.in>
EMAIL_REPLY_TO=support@vireqo.in
SUPPORT_EMAIL=support@vireqo.in
EMAIL_LOGO_URL=https://www.vireqo.in/icon.png
EMAIL_TIMEOUT_SECONDS=10
```

Keep this off until the Resend domain is verified and both emails are tested:

```env
REQUIRE_EMAIL_VERIFICATION=false
```

After testing, turn on:

```env
REQUIRE_EMAIL_VERIFICATION=true
```

## Resend setup checklist

1. Create a Resend account.
2. Add and verify your sending domain, ideally `vireqo.in`.
3. Add the DNS records Resend provides in GoDaddy.
4. Create a new Resend API key.
5. Add that key to Render as `RESEND_API_KEY`.
6. Set `EMAIL_FROM=Vireqo <hello@vireqo.in>` after the domain is verified.
7. Redeploy Render backend.
8. Test forgot password from the live site.
9. Test resend verification from the live site.
10. Only then set `REQUIRE_EMAIL_VERIFICATION=true`.

## Testing

### Password reset email

Open:

```text
https://www.vireqo.in/forgot-password
```

Submit the email of an existing account. You should receive a branded reset email with a one-time reset link.

### Verification email

Open:

```text
https://www.vireqo.in/verify-email
```

Submit the email of an unverified account. You should receive a branded verification email.

### Deployment check

Run locally with production-like variables:

```bash
python scripts/deploy_check.py
```

If `REQUIRE_EMAIL_VERIFICATION=true`, the deploy check fails unless both `RESEND_API_KEY` and `EMAIL_FROM` are configured.

## Notes

- Local development still works without Resend. In development mode, Vireqo may return the local reset/verification link in the API response when email is not configured.
- Production should not expose reset or verification tokens in API responses.
- If `REQUIRE_EMAIL_VERIFICATION=true`, unverified users cannot access protected API routes.
