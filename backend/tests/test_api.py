from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app


def test_complete_mvp_flow() -> None:
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "healthy"

        login = client.post("/api/v1/auth/demo")
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        leads_before = client.get("/api/v1/leads", headers=headers)
        assert leads_before.status_code == 200
        assert len(leads_before.json()) >= 5

        captured = client.post(
            "/api/v1/leads/capture/vireqo-demo",
            json={
                "name": "Test Lead",
                "email": "test@example.com",
                "phone": "+91 9000000000",
                "need": "Ready to book a demo this week",
                "budget": "₹30k",
                "timeline": "This week",
            },
        )
        assert captured.status_code == 201
        lead = captured.json()
        assert lead["temperature"] == "hot"

        status_update = client.patch(
            f"/api/v1/leads/{lead['id']}",
            headers=headers,
            json={"status": "qualified"},
        )
        assert status_update.status_code == 200
        assert status_update.json()["status"] == "qualified"

        chat = client.post(
            "/api/v1/chat/vireqo-demo",
            json={
                "session_id": "test-session-123456",
                "message": "I need pricing and want to book a call this week. testchat@example.com",
                "name": "Chat Lead",
            },
        )
        assert chat.status_code == 200
        assert chat.json()["lead_id"]
        assert chat.json()["score"] >= 45

        appointment = client.post(
            "/api/v1/appointments",
            json={
                "business_slug": "vireqo-demo",
                "lead_id": lead["id"],
                "name": "Test Lead",
                "email": "test@example.com",
                "starts_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                "note": "Product demonstration",
            },
        )
        assert appointment.status_code == 201

        analytics = client.get("/api/v1/analytics/summary", headers=headers)
        assert analytics.status_code == 200
        data = analytics.json()
        assert data["total_leads"] >= 7
        assert data["appointments"] >= 2



def test_health_exposes_current_backend_version() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["version"] == "0.6.0"
        assert payload["rate_limit_enabled"] is True



def test_database_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/health/db")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["version"] == "0.6.0"
        assert payload["ok"] is True
        assert payload["kind"] in {"sqlite", "postgresql"}
        assert isinstance(payload["tables"], int)
