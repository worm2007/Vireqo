from __future__ import annotations

import httpx

from ..config import settings


def send_password_reset_email(*, recipient: str, reset_url: str) -> bool:
    """Send with Resend when configured. Local development works without a key."""
    if not settings.resend_api_key:
        return False

    payload = {
        "from": settings.email_from,
        "to": [recipient],
        "subject": "Reset your Vireqo password",
        "html": (
            "<h2>Reset your Vireqo password</h2>"
            "<p>This link expires shortly and can be used only once.</p>"
            f'<p><a href="{reset_url}">Reset password</a></p>'
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    }
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        return False
