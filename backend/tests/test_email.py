from __future__ import annotations

from app.config import settings
from app.services import email as email_service


def test_password_reset_email_uses_resend_payload(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        content = b'{"id":"email_test_123"}'

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"id": "email_test_123"}

    def fake_post(url: str, *, headers: dict[str, str], json: dict[str, object], timeout: int):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        captured["timeout"] = timeout
        return FakeResponse()

    previous = {
        "resend_api_key": settings.resend_api_key,
        "email_from": settings.email_from,
        "email_reply_to": settings.email_reply_to,
        "support_email": settings.support_email,
        "email_logo_url": settings.email_logo_url,
        "email_timeout_seconds": settings.email_timeout_seconds,
    }

    try:
        object.__setattr__(settings, "resend_api_key", "re_test_key")
        object.__setattr__(settings, "email_from", "Vireqo <hello@vireqo.in>")
        object.__setattr__(settings, "email_reply_to", "support@vireqo.in")
        object.__setattr__(settings, "support_email", "support@vireqo.in")
        object.__setattr__(settings, "email_logo_url", "https://www.vireqo.in/icon.png")
        object.__setattr__(settings, "email_timeout_seconds", 10)
        monkeypatch.setattr(email_service.httpx, "post", fake_post)

        result = email_service.send_password_reset_email(
            recipient="user@example.com",
            reset_url="https://www.vireqo.in/reset-password?token=abc",
            token_hash="hashed-token",
        )

        assert result.sent is True
        assert result.message_id == "email_test_123"
        assert captured["url"] == email_service.RESEND_EMAILS_ENDPOINT
        headers = captured["headers"]
        assert isinstance(headers, dict)
        assert headers["Authorization"] == "Bearer re_test_key"
        assert headers["Idempotency-Key"] == "password-reset:hashed-token"
        payload = captured["json"]
        assert isinstance(payload, dict)
        assert payload["from"] == "Vireqo <hello@vireqo.in>"
        assert payload["to"] == ["user@example.com"]
        assert payload["reply_to"] == "support@vireqo.in"
        assert payload["subject"] == "Reset your Vireqo password"
        assert "Reset your Vireqo password" in str(payload["html"])
        assert "https://www.vireqo.in/reset-password?token=abc" in str(payload["text"])
    finally:
        for key, value in previous.items():
            object.__setattr__(settings, key, value)


def test_email_delivery_is_disabled_without_resend_key() -> None:
    previous_key = settings.resend_api_key
    try:
        object.__setattr__(settings, "resend_api_key", "")
        result = email_service.send_email_verification_email(
            recipient="user@example.com",
            verification_url="https://www.vireqo.in/verify-email?token=abc",
            token_hash="token-hash",
        )
        assert result.sent is False
        assert "RESEND_API_KEY" in (result.error or "")
    finally:
        object.__setattr__(settings, "resend_api_key", previous_key)
