from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app


def test_registration_auth_refresh_and_crm_management() -> None:
    suffix = uuid.uuid4().hex[:10]
    email = f"owner-{suffix}@example.com"
    member_email = f"member-{suffix}@example.com"
    password = "SecurePass123"
    new_password = "NewSecurePass456"

    with TestClient(app) as client:
        registered = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Test Owner",
                "email": email,
                "password": password,
                "business_name": f"Test Studio {suffix}",
                "industry": "Professional Services",
            },
        )
        assert registered.status_code == 201, registered.text
        auth = registered.json()
        assert auth["access_token"]
        assert auth["refresh_token"]
        assert auth["user"]["role"] == "owner"
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        duplicate = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Duplicate",
                "email": email,
                "password": password,
                "business_name": "Duplicate Studio",
                "industry": "Agency",
            },
        )
        assert duplicate.status_code == 409

        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["email"] == email

        refreshed = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": auth["refresh_token"]},
        )
        assert refreshed.status_code == 200, refreshed.text
        refreshed_auth = refreshed.json()
        assert refreshed_auth["refresh_token"] != auth["refresh_token"]
        headers = {"Authorization": f"Bearer {refreshed_auth['access_token']}"}

        old_refresh = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": auth["refresh_token"]},
        )
        assert old_refresh.status_code == 401

        business = client.patch(
            "/api/v1/businesses/me",
            headers=headers,
            json={
                "description": "A fully tested workspace",
                "greeting": "Welcome to the test concierge.",
                "brand_color": "#BFFF35",
            },
        )
        assert business.status_code == 200, business.text
        assert business.json()["description"] == "A fully tested workspace"
        business_slug = business.json()["slug"]

        member = client.post(
            "/api/v1/team",
            headers=headers,
            json={
                "name": "Test Member",
                "email": member_email,
                "password": "MemberPass123",
                "role": "member",
            },
        )
        assert member.status_code == 201, member.text
        member_id = member.json()["id"]

        disabled = client.patch(
            f"/api/v1/team/{member_id}",
            headers=headers,
            json={"is_active": False},
        )
        assert disabled.status_code == 200
        assert disabled.json()["is_active"] is False

        lead = client.post(
            "/api/v1/leads",
            headers=headers,
            json={
                "name": "CRM Test Lead",
                "email": f"lead-{suffix}@example.com",
                "phone": "+91 99999 11111",
                "company": "CRM Test Co",
                "need": "Need a demo and implementation this week",
                "budget": "₹50k",
                "timeline": "This week",
                "source": "Backend test",
            },
        )
        assert lead.status_code == 201, lead.text
        lead_data = lead.json()
        lead_id = lead_data["id"]
        assert lead_data["score"] >= 45

        fetched = client.get(f"/api/v1/leads/{lead_id}", headers=headers)
        assert fetched.status_code == 200
        assert fetched.json()["company"] == "CRM Test Co"

        updated = client.patch(
            f"/api/v1/leads/{lead_id}",
            headers=headers,
            json={"status": "qualified", "notes": "Owner reviewed this lead"},
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "qualified"

        searched = client.get(
            "/api/v1/leads?search=CRM%20Test&status=qualified",
            headers=headers,
        )
        assert searched.status_code == 200
        assert any(item["id"] == lead_id for item in searched.json())
        assert int(searched.headers["X-Total-Count"]) >= 1

        appointment = client.post(
            "/api/v1/appointments",
            json={
                "business_slug": business_slug,
                "lead_id": lead_id,
                "name": "CRM Test Lead",
                "email": f"lead-{suffix}@example.com",
                "starts_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
                "note": "Backend integration meeting",
            },
        )
        assert appointment.status_code == 201, appointment.text
        appointment_id = appointment.json()["id"]

        confirmed = client.patch(
            f"/api/v1/appointments/{appointment_id}",
            headers=headers,
            json={"status": "confirmed"},
        )
        assert confirmed.status_code == 200
        assert confirmed.json()["status"] == "confirmed"

        audit = client.get("/api/v1/audit", headers=headers)
        assert audit.status_code == 200
        actions = {item["action"] for item in audit.json()}
        assert "business.updated" in actions
        assert "lead.created" in actions

        forgot = client.post("/api/v1/auth/forgot-password", json={"email": email})
        assert forgot.status_code == 200
        reset_token = forgot.json()["reset_token"]
        assert reset_token

        reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_token, "new_password": new_password},
        )
        assert reset.status_code == 204

        old_login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert old_login.status_code == 401

        new_login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": new_password},
        )
        assert new_login.status_code == 200
        new_auth = new_login.json()
        new_headers = {"Authorization": f"Bearer {new_auth['access_token']}"}

        logout = client.post(
            "/api/v1/auth/logout",
            headers=new_headers,
            json={"refresh_token": new_auth["refresh_token"]},
        )
        assert logout.status_code == 204

        revoked_refresh = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": new_auth["refresh_token"]},
        )
        assert revoked_refresh.status_code == 401
