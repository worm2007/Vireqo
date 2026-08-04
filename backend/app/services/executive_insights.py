from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..models import Appointment, Lead, User


def _utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _clamp(value: float) -> int:
    return max(0, min(100, round(value)))


def _money_from_text(value: str) -> float | None:
    """Best-effort parser for values such as ₹50,000, 2 lakh or 1.5L."""
    if not value:
        return None
    cleaned = value.lower().replace(",", "").replace("₹", "").strip()
    match = re.search(r"(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|l|k|thousand)?", cleaned)
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2) or ""
    multiplier = {
        "crore": 10_000_000,
        "cr": 10_000_000,
        "lakh": 100_000,
        "lac": 100_000,
        "l": 100_000,
        "k": 1_000,
        "thousand": 1_000,
    }.get(unit, 1)
    return number * multiplier


def _format_inr(value: float | None) -> str | None:
    if value is None or value <= 0:
        return None
    if value >= 10_000_000:
        return f"₹{value / 10_000_000:.1f}Cr"
    if value >= 100_000:
        return f"₹{value / 100_000:.1f}L"
    if value >= 1_000:
        return f"₹{value / 1_000:.0f}K"
    return f"₹{value:.0f}"


def build_executive_insights(db: Session, current_user: User) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    business_id = current_user.business_id

    leads = list(
        db.scalars(
            select(Lead)
            .where(Lead.business_id == business_id)
            .order_by(desc(Lead.updated_at))
        ).all()
    )
    appointments = list(
        db.scalars(
            select(Appointment)
            .where(Appointment.business_id == business_id)
            .order_by(Appointment.starts_at)
        ).all()
    )

    total = len(leads)
    active = [lead for lead in leads if lead.status not in {"won", "lost"}]
    hot = [lead for lead in active if lead.temperature == "hot"]
    qualified = [lead for lead in active if lead.status == "qualified"]
    won = [lead for lead in leads if lead.status == "won"]
    stale = [lead for lead in active if now - _utc(lead.updated_at) >= timedelta(hours=24)]
    urgent = [lead for lead in hot if now - _utc(lead.updated_at) >= timedelta(hours=12)]

    today = now.date()
    todays_appointments = [
        item
        for item in appointments
        if _utc(item.starts_at).date() == today and item.status not in {"cancelled", "completed"}
    ]
    upcoming = [
        item
        for item in appointments
        if _utc(item.starts_at) >= now and item.status not in {"cancelled", "completed"}
    ]
    completed = [item for item in appointments if item.status == "completed"]
    missed = [item for item in appointments if item.status in {"cancelled", "no_show"}]

    average_score = sum(lead.score for lead in leads) / total if total else 0
    lead_quality = _clamp(average_score)
    pipeline_health = _clamp(
        45
        + (len(qualified) / max(1, len(active))) * 30
        + (len(hot) / max(1, len(active))) * 20
        + (len(won) / max(1, total)) * 15
        - (len(stale) / max(1, len(active))) * 20
    )
    follow_up = _clamp(100 - (len(stale) / max(1, len(active))) * 100) if active else 100
    appointment_health = _clamp(
        70
        + min(20, len(upcoming) * 4)
        + (len(completed) / max(1, len(appointments))) * 20
        - (len(missed) / max(1, len(appointments))) * 25
    ) if appointments else 70
    response_speed = _clamp(95 - (len(urgent) / max(1, len(active))) * 65) if active else 100
    health_score = _clamp(
        lead_quality * 0.25
        + pipeline_health * 0.25
        + follow_up * 0.20
        + appointment_health * 0.15
        + response_speed * 0.15
    )

    health_label = "Excellent" if health_score >= 85 else "Healthy" if health_score >= 70 else "Needs attention" if health_score >= 50 else "At risk"

    priorities: list[dict[str, Any]] = []
    for lead in sorted(urgent, key=lambda item: (-item.score, _utc(item.updated_at)))[:3]:
        priorities.append({
            "type": "lead",
            "title": f"Contact {lead.name}",
            "detail": f"High-intent opportunity · score {lead.score} · inactive for more than 12 hours",
            "href": f"/dashboard/opportunities?edit={lead.id}",
            "urgency": "high",
        })
    for item in todays_appointments[:2]:
        priorities.append({
            "type": "appointment",
            "title": f"Prepare for {item.name}",
            "detail": _utc(item.starts_at).strftime("Today at %I:%M %p UTC"),
            "href": "/dashboard/appointments",
            "urgency": "high" if (_utc(item.starts_at) - now) <= timedelta(hours=2) else "medium",
        })
    if not priorities and qualified:
        lead = sorted(qualified, key=lambda item: -item.score)[0]
        priorities.append({
            "type": "lead",
            "title": f"Advance {lead.name}",
            "detail": "Qualified opportunity ready for a clear next step",
            "href": f"/dashboard/opportunities?edit={lead.id}",
            "urgency": "medium",
        })
    if not priorities:
        priorities.append({
            "type": "growth",
            "title": "Capture your next opportunity",
            "detail": "Use the AI concierge or add a lead manually to build your pipeline",
            "href": "/dashboard/ai-assistant",
            "urgency": "normal",
        })

    source_counts = Counter((lead.source or "Unknown").strip() for lead in leads)
    top_source, top_source_count = source_counts.most_common(1)[0] if source_counts else ("No source yet", 0)

    notifications: list[dict[str, Any]] = []
    if urgent:
        notifications.append({
            "kind": "warning",
            "title": f"{len(urgent)} high-intent lead{'s' if len(urgent) != 1 else ''} need attention",
            "detail": "These opportunities have been inactive for at least 12 hours.",
            "href": "/dashboard/opportunities?temperature=hot",
        })
    if todays_appointments:
        notifications.append({
            "kind": "appointment",
            "title": f"{len(todays_appointments)} meeting{'s' if len(todays_appointments) != 1 else ''} today",
            "detail": "Review notes and confirm attendees before the meeting.",
            "href": "/dashboard/appointments",
        })
    if stale:
        notifications.append({
            "kind": "follow_up",
            "title": f"{len(stale)} follow-up{'s' if len(stale) != 1 else ''} overdue",
            "detail": "Active opportunities have had no update for more than 24 hours.",
            "href": "/dashboard/opportunities",
        })
    if top_source_count:
        notifications.append({
            "kind": "source",
            "title": f"{top_source} is your leading source",
            "detail": f"It generated {top_source_count} of {total} recorded opportunities.",
            "href": "/dashboard/opportunities",
        })

    parsed_budgets = [value for value in (_money_from_text(lead.budget) for lead in active) if value]
    pipeline_value = sum(parsed_budgets) if parsed_budgets else None
    weighted_value = None
    if parsed_budgets:
        weighted_value = sum(
            (_money_from_text(lead.budget) or 0) * max(0.1, min(1, lead.score / 100))
            for lead in active
        )

    recommended = priorities[0]
    summary_parts = []
    if hot:
        summary_parts.append(f"{len(hot)} high-intent opportunit{'y' if len(hot) == 1 else 'ies'}")
    if todays_appointments:
        summary_parts.append(f"{len(todays_appointments)} meeting{'s' if len(todays_appointments) != 1 else ''} today")
    if stale:
        summary_parts.append(f"{len(stale)} overdue follow-up{'s' if len(stale) != 1 else ''}")
    if not summary_parts:
        summary_parts.append("your workspace is clear of urgent follow-ups")

    return {
        "generated_at": now.isoformat(),
        "health": {
            "score": health_score,
            "label": health_label,
            "components": {
                "lead_quality": lead_quality,
                "pipeline": pipeline_health,
                "follow_up": follow_up,
                "appointments": appointment_health,
                "response_speed": response_speed,
            },
        },
        "executive_summary": f"You have {', '.join(summary_parts)}. Your business health is {health_label.lower()} at {health_score}/100.",
        "recommended_action": {
            "title": recommended["title"],
            "detail": recommended["detail"],
            "href": recommended["href"],
        },
        "priorities": priorities[:5],
        "notifications": notifications[:5],
        "metrics": {
            "pipeline_health": pipeline_health,
            "lead_quality": lead_quality,
            "follow_up_rate": follow_up,
            "response_speed": response_speed,
            "ai_confidence": _clamp(55 + min(35, total * 3)),
            "pipeline_value": _format_inr(pipeline_value),
            "weighted_forecast": _format_inr(weighted_value),
            "top_source": top_source,
            "today_appointments": len(todays_appointments),
            "overdue_follow_ups": len(stale),
        },
    }
