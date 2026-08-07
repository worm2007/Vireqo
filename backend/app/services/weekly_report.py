from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..models import Appointment, Conversation, Lead, User
from .lead_scoring import calculate_lead_intelligence, parse_budget_value
from .revenue_forecast import build_revenue_forecast

OPEN_STATUSES = {"new", "contacted", "qualified"}
CLOSED_WON_STATUSES = {"won"}


def _utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _clamp(value: float | int, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, int(round(value))))


def _format_inr(value: int | float | None) -> str:
    amount = int(round(value or 0))
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.1f}Cr"
    if amount >= 100_000:
        return f"₹{amount / 100_000:.1f}L"
    if amount >= 1_000:
        return f"₹{amount / 1_000:.0f}K"
    return f"₹{amount}"


def _week_start(now: datetime) -> datetime:
    start = now - timedelta(days=now.weekday())
    return start.replace(hour=0, minute=0, second=0, microsecond=0)


def _between(value: datetime | None, start: datetime, end: datetime) -> bool:
    current = _utc(value)
    return start <= current < end


def _delta(current: int | float, previous: int | float) -> int:
    if previous <= 0:
        return 100 if current > 0 else 0
    return _clamp(((current - previous) / previous) * 100, -100, 300)


def _source_label(source: str) -> str:
    value = (source or "Unknown").strip()
    return value or "Unknown"


def _lead_value(lead: Lead) -> int:
    parsed = parse_budget_value(lead.budget or "")
    if parsed:
        return parsed
    if lead.status == "qualified" or lead.temperature == "hot":
        return 125_000
    if lead.status == "contacted" or lead.temperature == "warm":
        return 60_000
    return 25_000


def build_weekly_report(db: Session, current_user: User) -> dict[str, Any]:
    """Build a deterministic weekly executive report from workspace data.

    The report intentionally avoids an external LLM call so it is fast, testable,
    and safe to show every time the dashboard loads. It can be upgraded later to
    use Groq for wording while keeping the same analytics contract.
    """
    now = datetime.now(timezone.utc)
    start = _week_start(now)
    end = start + timedelta(days=7)
    previous_start = start - timedelta(days=7)

    business_id = current_user.business_id
    leads = list(
        db.scalars(
            select(Lead)
            .where(Lead.business_id == business_id)
            .order_by(desc(Lead.updated_at), desc(Lead.created_at))
        ).all()
    )
    appointments = list(
        db.scalars(
            select(Appointment)
            .where(Appointment.business_id == business_id)
            .order_by(Appointment.starts_at)
        ).all()
    )
    conversations = list(
        db.scalars(
            select(Conversation)
            .where(Conversation.business_id == business_id)
            .order_by(desc(Conversation.updated_at))
        ).all()
    )

    week_leads = [lead for lead in leads if _between(lead.created_at, start, end)]
    previous_week_leads = [lead for lead in leads if _between(lead.created_at, previous_start, start)]
    week_updates = [lead for lead in leads if _between(lead.updated_at, start, end)]
    week_appointments = [item for item in appointments if _between(item.created_at, start, end)]
    week_meetings = [item for item in appointments if _between(item.starts_at, start, end)]
    previous_week_appointments = [item for item in appointments if _between(item.created_at, previous_start, start)]
    week_conversations = [item for item in conversations if _between(item.updated_at, start, end)]
    previous_week_conversations = [item for item in conversations if _between(item.updated_at, previous_start, start)]

    active_leads = [lead for lead in leads if lead.status in OPEN_STATUSES]
    won_leads = [lead for lead in leads if lead.status in CLOSED_WON_STATUSES]
    qualified_leads = [lead for lead in leads if lead.status == "qualified"]
    hot_leads = [lead for lead in active_leads if lead.temperature == "hot"]
    stale_leads = [lead for lead in active_leads if now - _utc(lead.updated_at) >= timedelta(hours=48)]

    source_counts = Counter(_source_label(lead.source) for lead in week_leads or leads)
    top_source, top_source_count = source_counts.most_common(1)[0] if source_counts else ("No source yet", 0)

    forecast = build_revenue_forecast(db, current_user)
    forecast_summary = forecast["summary"]

    intelligence_items = []
    lead_ids = [lead.id for lead in leads]
    appointment_map: dict[str, list[Appointment]] = {lead_id: [] for lead_id in lead_ids}
    for appointment in appointments:
        if appointment.lead_id:
            appointment_map.setdefault(appointment.lead_id, []).append(appointment)

    conversation_count_map: dict[str, int] = {lead_id: 0 for lead_id in lead_ids}
    for conversation in conversations:
        if conversation.lead_id:
            conversation_count_map[conversation.lead_id] = conversation_count_map.get(conversation.lead_id, 0) + 1

    for lead in active_leads:
        intelligence_items.append(
            (
                lead,
                calculate_lead_intelligence(
                    lead=lead,
                    appointments=appointment_map.get(lead.id, []),
                    conversation_count=conversation_count_map.get(lead.id, 0),
                ),
            )
        )
    intelligence_items.sort(key=lambda pair: (pair[1].conversion_probability, pair[1].score), reverse=True)

    pipeline_created = sum(_lead_value(lead) for lead in week_leads)
    average_score = round(sum(lead.score for lead in leads) / len(leads), 1) if leads else 0.0
    conversion_rate = round((len(won_leads) / len(leads) * 100), 1) if leads else 0.0
    weekly_velocity = _clamp(
        len(week_leads) * 7
        + len(week_updates) * 3
        + len(week_appointments) * 5
        + len(week_conversations) * 2
        + len([lead for lead in week_leads if lead.temperature == "hot"]) * 6,
        0,
        100,
    )

    highlights: list[str] = []
    if week_leads:
        highlights.append(f"{len(week_leads)} new lead{'s' if len(week_leads) != 1 else ''} entered the pipeline this week.")
    if qualified_leads:
        highlights.append(f"{len(qualified_leads)} qualified opportunit{'ies' if len(qualified_leads) != 1 else 'y'} are ready for stronger closing actions.")
    if forecast_summary["weighted_forecast"]:
        highlights.append(f"Weighted forecast is currently {forecast_summary['weighted_forecast_label']} from {forecast_summary['pipeline_value_label']} pipeline.")
    if week_appointments:
        highlights.append(f"{len(week_appointments)} appointment{'s' if len(week_appointments) != 1 else ''} were booked this week.")
    if top_source_count:
        highlights.append(f"{top_source} is the strongest source signal with {top_source_count} lead{'s' if top_source_count != 1 else ''}.")
    if not highlights:
        highlights.append("Workspace activity is still light this week. Add leads with budget and timeline to unlock stronger weekly reporting.")

    risks: list[dict[str, Any]] = []
    if stale_leads:
        risks.append({
            "level": "high" if len(stale_leads) >= 3 else "medium",
            "title": f"{len(stale_leads)} follow-up{'s' if len(stale_leads) != 1 else ''} may be slipping",
            "detail": "Open opportunities have had no update for more than 48 hours.",
            "href": "/dashboard/opportunities",
        })
    if forecast_summary["at_risk_value"] > 0:
        risks.append({
            "level": "high",
            "title": f"{forecast_summary['at_risk_value_label']} is at risk",
            "detail": "Some revenue has weak timeline, budget, or follow-up signals.",
            "href": "/dashboard/opportunities",
        })
    if forecast["signals"]["missing_budget_count"]:
        risks.append({
            "level": "medium",
            "title": f"{forecast['signals']['missing_budget_count']} leads are missing budget",
            "detail": "Forecast confidence improves when every active lead has budget data.",
            "href": "/dashboard/opportunities",
        })
    if not risks:
        risks.append({
            "level": "low",
            "title": "No major weekly risk detected",
            "detail": "Keep updating lead notes, meetings and timelines to maintain forecast quality.",
            "href": "/dashboard/opportunities",
        })

    wins: list[dict[str, Any]] = []
    if hot_leads:
        wins.append({
            "title": f"{len(hot_leads)} hot lead{'s' if len(hot_leads) != 1 else ''} in play",
            "detail": "Prioritize fast outreach while intent is fresh.",
            "metric": str(len(hot_leads)),
        })
    if forecast_summary["committed_value"]:
        wins.append({
            "title": "Committed revenue detected",
            "detail": "Won opportunities are contributing to the forecast baseline.",
            "metric": forecast_summary["committed_value_label"],
        })
    if week_conversations:
        wins.append({
            "title": "AI conversations are creating context",
            "detail": "Recent conversations can improve lead follow-up quality.",
            "metric": str(len(week_conversations)),
        })
    if not wins:
        wins.append({
            "title": "Your CRM foundation is ready",
            "detail": "Create leads, conversations and meetings this week to generate stronger wins.",
            "metric": "Ready",
        })

    action_plan: list[dict[str, Any]] = []
    if intelligence_items:
        top_lead, top_prediction = intelligence_items[0]
        action_plan.append({
            "priority": "high" if top_prediction.conversion_probability >= 65 else "medium",
            "title": f"Move {top_lead.name} forward",
            "detail": top_prediction.next_action,
            "href": f"/dashboard/opportunities?edit={top_lead.id}",
        })
    if stale_leads:
        action_plan.append({
            "priority": "high",
            "title": "Recover overdue follow-ups",
            "detail": "Contact stale hot and qualified leads before adding more cold pipeline.",
            "href": "/dashboard/opportunities",
        })
    if forecast["signals"]["missing_budget_count"]:
        action_plan.append({
            "priority": "medium",
            "title": "Improve forecast confidence",
            "detail": "Add budgets and timelines to open leads with missing qualification data.",
            "href": "/dashboard/opportunities",
        })
    if not week_appointments:
        action_plan.append({
            "priority": "medium",
            "title": "Book one qualified meeting",
            "detail": "Turn the best warm lead into a scheduled appointment this week.",
            "href": "/dashboard/appointments",
        })
    if len(action_plan) < 3:
        action_plan.append({
            "priority": "normal",
            "title": "Ask AI for a pipeline summary",
            "detail": "Use the Command Center to summarize hot leads and next steps.",
            "href": "/dashboard/ai-assistant",
        })

    top_opportunities = [
        {
            "lead_id": lead.id,
            "name": lead.name,
            "company": lead.company,
            "score": prediction.score,
            "conversion_probability": prediction.conversion_probability,
            "value_label": _format_inr(prediction.estimated_budget_value or _lead_value(lead)),
            "next_action": prediction.next_action,
        }
        for lead, prediction in intelligence_items[:4]
    ]

    if len(week_leads) > len(previous_week_leads):
        trend_line = "Lead creation improved compared with last week."
    elif len(week_leads) < len(previous_week_leads):
        trend_line = "Lead creation slowed compared with last week."
    else:
        trend_line = "Lead creation is steady compared with last week."

    headline = "Weekly momentum is building" if weekly_velocity >= 65 else "Weekly momentum needs focus" if weekly_velocity < 35 else "Weekly momentum is stable"
    summary = (
        f"This week, {len(week_leads)} new lead{'s' if len(week_leads) != 1 else ''}, "
        f"{len(week_appointments)} booked appointment{'s' if len(week_appointments) != 1 else ''}, "
        f"and {forecast_summary['weighted_forecast_label']} weighted forecast are visible in the workspace. "
        f"{trend_line}"
    )

    return {
        "generated_at": now,
        "period_start": start,
        "period_end": min(now, end),
        "headline": headline,
        "summary": summary,
        "weekly_velocity": weekly_velocity,
        "metrics": {
            "new_leads": len(week_leads),
            "lead_growth_delta": _delta(len(week_leads), len(previous_week_leads)),
            "updated_leads": len(week_updates),
            "qualified_leads": len(qualified_leads),
            "won_leads": len(won_leads),
            "appointments_booked": len(week_appointments),
            "appointment_delta": _delta(len(week_appointments), len(previous_week_appointments)),
            "meetings_this_week": len(week_meetings),
            "conversations": len(week_conversations),
            "conversation_delta": _delta(len(week_conversations), len(previous_week_conversations)),
            "pipeline_created": pipeline_created,
            "pipeline_created_label": _format_inr(pipeline_created),
            "weighted_forecast": forecast_summary["weighted_forecast"],
            "weighted_forecast_label": forecast_summary["weighted_forecast_label"],
            "at_risk_value": forecast_summary["at_risk_value"],
            "at_risk_value_label": forecast_summary["at_risk_value_label"],
            "average_score": average_score,
            "conversion_rate": conversion_rate,
            "overdue_follow_ups": len(stale_leads),
            "top_source": top_source,
        },
        "highlights": highlights[:5],
        "wins": wins[:3],
        "risks": risks[:4],
        "action_plan": action_plan[:5],
        "top_opportunities": top_opportunities,
    }
