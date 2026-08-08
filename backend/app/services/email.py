from __future__ import annotations

from dataclasses import dataclass
from html import escape
from typing import Any

import httpx

from ..config import settings

RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails"


@dataclass(frozen=True)
class EmailSendResult:
    sent: bool
    provider: str = "resend"
    message_id: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class TransactionalEmail:
    recipient: str
    subject: str
    preview: str
    headline: str
    body: str
    cta_label: str
    cta_url: str
    footer_note: str


def email_delivery_configured() -> bool:
    return bool(settings.resend_api_key.strip() and settings.email_from.strip())


def _support_email() -> str:
    return settings.support_email or "support@vireqo.in"


def _logo_url() -> str:
    return settings.email_logo_url or f"{settings.frontend_url}/icon.png"


def _html_email(message: TransactionalEmail) -> str:
    preview = escape(message.preview)
    headline = escape(message.headline)
    body = escape(message.body)
    footer_note = escape(message.footer_note)
    cta_label = escape(message.cta_label)
    cta_url = escape(message.cta_url, quote=True)
    logo_url = escape(_logo_url(), quote=True)
    support = escape(_support_email())

    return f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{headline}</title>
    <style>
      body {{ margin: 0; padding: 0; background: #f7f2e8; color: #14372d; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
      a {{ color: inherit; }}
      .shell {{ width: 100%; background: #f7f2e8; padding: 28px 14px; }}
      .card {{ max-width: 620px; margin: 0 auto; background: #fffdf7; border: 1px solid #e9dfc8; border-radius: 28px; overflow: hidden; box-shadow: 0 24px 70px rgba(20, 55, 45, 0.12); }}
      .header {{ padding: 30px 34px 14px; }}
      .brand {{ display: inline-flex; align-items: center; gap: 12px; font-weight: 800; letter-spacing: -0.02em; font-size: 22px; }}
      .brand img {{ width: 36px; height: 36px; border-radius: 12px; vertical-align: middle; }}
      .content {{ padding: 12px 34px 34px; }}
      .eyebrow {{ color: #6f766c; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }}
      h1 {{ margin: 12px 0 12px; font-size: 30px; line-height: 1.1; letter-spacing: -0.04em; color: #102f27; }}
      p {{ margin: 0 0 18px; color: #45514a; line-height: 1.65; font-size: 16px; }}
      .button {{ display: inline-block; background: #b9f33b; color: #102f27; text-decoration: none; font-weight: 800; padding: 14px 20px; border-radius: 999px; margin: 8px 0 20px; }}
      .url {{ word-break: break-all; font-size: 13px; color: #6f766c; background: #f4efe2; padding: 12px 14px; border-radius: 16px; }}
      .footer {{ padding: 24px 34px 32px; border-top: 1px solid #eee3cd; color: #7a8278; font-size: 13px; line-height: 1.6; }}
      .hidden {{ display: none; max-height: 0; overflow: hidden; opacity: 0; }}
    </style>
  </head>
  <body>
    <div class="hidden">{preview}</div>
    <div class="shell">
      <div class="card">
        <div class="header">
          <div class="brand"><img src="{logo_url}" alt="Vireqo" /> Vireqo</div>
        </div>
        <div class="content">
          <div class="eyebrow">Security email</div>
          <h1>{headline}</h1>
          <p>{body}</p>
          <a class="button" href="{cta_url}">{cta_label}</a>
          <p class="url">{cta_url}</p>
          <p>{footer_note}</p>
        </div>
        <div class="footer">
          You received this email because this address is connected to a Vireqo workspace. Need help? Contact {support}.
        </div>
      </div>
    </div>
  </body>
</html>
""".strip()


def _text_email(message: TransactionalEmail) -> str:
    return "\n\n".join(
        [
            "Vireqo",
            message.headline,
            message.body,
            f"{message.cta_label}: {message.cta_url}",
            message.footer_note,
            f"Need help? Contact {_support_email()}.",
        ]
    )


def _resend_payload(message: TransactionalEmail) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "from": settings.email_from,
        "to": [message.recipient],
        "subject": message.subject,
        "html": _html_email(message),
        "text": _text_email(message),
    }
    if settings.email_reply_to:
        payload["reply_to"] = settings.email_reply_to
    return payload


def send_transactional_email(message: TransactionalEmail, *, idempotency_key: str | None = None) -> EmailSendResult:
    if not email_delivery_configured():
        return EmailSendResult(sent=False, error="RESEND_API_KEY or EMAIL_FROM is not configured")

    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key

    try:
        response = httpx.post(
            RESEND_EMAILS_ENDPOINT,
            headers=headers,
            json=_resend_payload(message),
            timeout=settings.email_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json() if response.content else {}
        message_id = data.get("id") if isinstance(data, dict) else None
        return EmailSendResult(sent=True, message_id=message_id)
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500] if exc.response is not None else exc.__class__.__name__
        return EmailSendResult(sent=False, error=detail)
    except httpx.HTTPError as exc:
        return EmailSendResult(sent=False, error=exc.__class__.__name__)


def send_password_reset_email(*, recipient: str, reset_url: str, token_hash: str = "") -> EmailSendResult:
    message = TransactionalEmail(
        recipient=recipient,
        subject="Reset your Vireqo password",
        preview="Use this secure one-time link to reset your Vireqo password.",
        headline="Reset your Vireqo password",
        body="We received a request to reset your Vireqo password. This link expires automatically and can be used only once.",
        cta_label="Reset password",
        cta_url=reset_url,
        footer_note="If you did not request a password reset, you can safely ignore this email.",
    )
    idempotency_key = f"password-reset:{token_hash}" if token_hash else None
    return send_transactional_email(message, idempotency_key=idempotency_key)


def send_email_verification_email(*, recipient: str, verification_url: str, token_hash: str = "") -> EmailSendResult:
    message = TransactionalEmail(
        recipient=recipient,
        subject="Verify your Vireqo email",
        preview="Confirm your email address to protect your Vireqo workspace.",
        headline="Verify your email",
        body="Confirm this email address to protect your workspace, enable account recovery, and receive important security notices.",
        cta_label="Verify email",
        cta_url=verification_url,
        footer_note="If you did not create a Vireqo workspace, you can safely ignore this email.",
    )
    idempotency_key = f"email-verification:{token_hash}" if token_hash else None
    return send_transactional_email(message, idempotency_key=idempotency_key)
