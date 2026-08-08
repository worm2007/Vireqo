from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from ..models import Appointment, Conversation, Lead, User
from ..schemas import (
    PipelineAutomationAction,
    PipelineAutomationResponse,
    PipelineAutomationRule,
    PipelineAutomationSummary,
)
from .lead_scoring import calculate_lead_intelligence, parse_budget_value

OPEN_STATUSES = {"new", "contacted", "qualified"}
STAGE_LABELS = {
    "new": "New",
    "contacted": "Contacted",
    "qualified": "Qualified",
    "won": "Won",
    "lost": "Lost",
}


@dataclass(frozen=True)
class LeadSignals:
    latest_touch_at: datetime | None
    upcoming_meeting_at: datetime | None
    completed_meetings: int
    conversation_count: int
    appointment_count: int


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _hours_since(value: datetime | None, now: datetime) -> float | None:
    current = _utc(value)
    if current is None:
        return None
    return max(0.0, (now - current).total_seconds() / 3600)


def _hours_until(value: datetime | None, now: datetime) -> float | None:
    current = _utc(value)
    if current is None:
        return None
    return (current - now).total_seconds() / 3600


def _priority_rank(priority: str) -> int:
    return {"urgent": 4, "high": 3, "medium": 2, "low": 1}.get(priority, 0)


def _format_age(hours: float | None) -> str:
    if hours is None:
        return "No touch recorded"
    if hours < 1:
        return "Just now"
    if hours < 24:
        return f"{int(round(hours))}h since touch"
    return f"{int(round(hours / 24))}d since touch"


def _format_due(hours: float | None) -> str:
    if hours is None:
        return "Action due"
    if hours < 0:
        return "Overdue"
    if hours <= 1:
        return "Due in 1h"
    if hours < 24:
        return f"Due in {int(round(hours))}h"
    return f"Due in {int(round(hours / 24))}d"


def _stage_stale_limit(status: str) -> int:
    if status == "new":
        return 12
    if status == "contacted":
        return 48
    if status == "qualified":
        return 72
    return 120


def _estimate_impact(lead: Lead, probability: int) -> str:
    value = parse_budget_value(lead.budget)
    if value and probability >= 70:
        return "Protect high-value pipeline"
    if value:
        return "Improve forecast quality"
    if probability >= 70 or lead.temperature == "hot":
        return "Protect hot opportunity"
    return "Improve pipeline hygiene"


def _rule_catalog(rule_counts: dict[str, int]) -> list[PipelineAutomationRule]:
    rules = [
        PipelineAutomationRule(
            id="hot_stale_followup",
            title="Hot lead follow-up",
            description="High-intent leads should not wait more than 24 hours without a touch.",
            severity="urgent",
            trigger_count=rule_counts.get("hot_stale_followup", 0),
            recommendation="Send a focused follow-up, answer pricing questions and ask for the next meeting.",
        ),
        PipelineAutomationRule(
            id="new_response_due",
            title="First response due",
            description="New opportunities should receive a first response quickly before intent cools down.",
            severity="high",
            trigger_count=rule_counts.get("new_response_due", 0),
            recommendation="Contact the lead and collect missing budget, timeline and decision details.",
        ),
        PipelineAutomationRule(
            id="qualified_needs_meeting",
            title="Qualified deal needs meeting",
            description="Qualified opportunities without a booked meeting need a clear next step.",
            severity="high",
            trigger_count=rule_counts.get("qualified_needs_meeting", 0),
            recommendation="Schedule a demo, pricing review or closing call.",
        ),
        PipelineAutomationRule(
            id="stage_progression",
            title="Stage progression suggestion",
            description="Strong leads should be moved forward so the pipeline remains accurate.",
            severity="medium",
            trigger_count=rule_counts.get("stage_progression", 0),
            recommendation="Move qualified-intent leads to the correct stage after reviewing details.",
        ),
        PipelineAutomationRule(
            id="qualification_gap",
            title="Qualification gap",
            description="Budget, timeline or contact details are missing on active opportunities.",
            severity="medium",
            trigger_count=rule_counts.get("qualification_gap", 0),
            recommendation="Enrich the opportunity before relying on revenue forecasts.",
        ),
        PipelineAutomationRule(
            id="meeting_confirmation",
            title="Meeting confirmation",
            description="Upcoming meetings should be confirmed before the call window.",
            severity="medium",
            trigger_count=rule_counts.get("meeting_confirmation", 0),
            recommendation="Send a meeting confirmation with agenda and expected outcome.",
        ),
    ]
    return rules


def _action(
    *,
    lead: Lead,
    rule_id: str,
    rule_label: str,
    priority: str,
    title: str,
    description: str,
    cta_label: str,
    estimated_impact: str,
    reason: str,
    due_label: str,
    latest_touch_at: datetime | None,
    suggested_status: str | None = None,
) -> PipelineAutomationAction:
    return PipelineAutomationAction(
        id=f"{rule_id}:{lead.id}",
        lead_id=lead.id,
        lead_name=lead.name,
        company=lead.company,
        status=lead.status,
        priority=priority,
        rule_id=rule_id,
        rule_label=rule_label,
        title=title,
        description=description,
        suggested_status=suggested_status,
        cta_label=cta_label,
        href=f"/dashboard/opportunities?detail={lead.id}",
        estimated_impact=estimated_impact,
        reason=reason,
        due_label=due_label,
        latest_touch_at=latest_touch_at,
    )


def build_pipeline_automation(db: Session, user: User) -> PipelineAutomationResponse:
    """Return deterministic pipeline automation recommendations for one workspace.

    Sprint 3.2 intentionally avoids a database migration. These are generated rules and
    suggested actions that can become persisted tasks in Sprint 3.3.
    """
    business_id = user.business_id
    now = datetime.now(timezone.utc)

    leads = list(
        db.scalars(
            select(Lead)
            .where(Lead.business_id == business_id)
            .order_by(desc(Lead.updated_at), desc(Lead.created_at))
            .limit(500)
        ).all()
    )
    lead_ids = [lead.id for lead in leads]

    appointment_map: dict[str, list[Appointment]] = {lead_id: [] for lead_id in lead_ids}
    conversation_count_map: dict[str, int] = {lead_id: 0 for lead_id in lead_ids}
    conversation_touch_map: dict[str, datetime | None] = {lead_id: None for lead_id in lead_ids}

    if lead_ids:
        appointments = list(
            db.scalars(
                select(Appointment).where(
                    Appointment.business_id == business_id,
                    Appointment.lead_id.in_(lead_ids),
                )
            ).all()
        )
        for appointment in appointments:
            if appointment.lead_id:
                appointment_map.setdefault(appointment.lead_id, []).append(appointment)

        conversation_rows = db.execute(
            select(
                Conversation.lead_id,
                func.count(Conversation.id),
                func.max(Conversation.updated_at),
            )
            .where(
                Conversation.business_id == business_id,
                Conversation.lead_id.in_(lead_ids),
            )
            .group_by(Conversation.lead_id)
        ).all()
        for lead_id, count, latest in conversation_rows:
            if not lead_id:
                continue
            conversation_count_map[str(lead_id)] = int(count)
            conversation_touch_map[str(lead_id)] = _utc(latest)

    actions: list[PipelineAutomationAction] = []
    rule_counts: dict[str, int] = {}

    for lead in leads:
        status = (lead.status or "new").lower()
        if status not in OPEN_STATUSES:
            continue

        appointments_for_lead = appointment_map.get(lead.id, [])
        upcoming = [
            appointment
            for appointment in appointments_for_lead
            if appointment.status in {"booked", "confirmed"} and (_utc(appointment.starts_at) or now) >= now
        ]
        completed = [appointment for appointment in appointments_for_lead if appointment.status == "completed"]
        upcoming.sort(key=lambda item: _utc(item.starts_at) or now)

        latest_candidates: list[datetime] = []
        if lead.updated_at:
            latest_candidates.append(_utc(lead.updated_at) or lead.updated_at)
        if conversation_touch_map.get(lead.id):
            latest_candidates.append(conversation_touch_map[lead.id] or now)
        for appointment in appointments_for_lead:
            if appointment.created_at:
                latest_candidates.append(_utc(appointment.created_at) or appointment.created_at)

        latest_touch = max(latest_candidates) if latest_candidates else _utc(lead.created_at)
        hours_since_touch = _hours_since(latest_touch, now)
        age_hours = _hours_since(_utc(lead.created_at), now) or 0
        next_meeting = upcoming[0] if upcoming else None
        hours_until_meeting = _hours_until(next_meeting.starts_at if next_meeting else None, now)

        intelligence = calculate_lead_intelligence(
            lead=lead,
            appointments=appointments_for_lead,
            conversation_count=conversation_count_map.get(lead.id, 0),
        )
        estimated_impact = _estimate_impact(lead, intelligence.conversion_probability)
        data_missing = [
            label
            for label, value in (
                ("email", lead.email),
                ("phone", lead.phone),
                ("budget", lead.budget),
                ("timeline", lead.timeline),
            )
            if not str(value or "").strip()
        ]

        # 1. Hot/stale follow-up.
        stale_limit = _stage_stale_limit(status)
        if (lead.temperature == "hot" or intelligence.conversion_probability >= 70) and (hours_since_touch is None or hours_since_touch >= 24):
            rule_counts["hot_stale_followup"] = rule_counts.get("hot_stale_followup", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="hot_stale_followup",
                    rule_label="Hot lead follow-up",
                    priority="urgent",
                    title=f"Follow up with {lead.name}",
                    description="This is a high-intent opportunity and it has gone quiet.",
                    cta_label="Open deal",
                    estimated_impact=estimated_impact,
                    reason=f"{intelligence.conversion_probability}% close chance · {_format_age(hours_since_touch)}",
                    due_label="Due now",
                    latest_touch_at=latest_touch,
                )
            )

        # 2. First response for untouched new leads.
        if status == "new" and age_hours >= 12 and conversation_count_map.get(lead.id, 0) == 0:
            rule_counts["new_response_due"] = rule_counts.get("new_response_due", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="new_response_due",
                    rule_label="First response due",
                    priority="high",
                    title=f"Send first response to {lead.name}",
                    description="New leads lose intent quickly when no first response is recorded.",
                    cta_label="Open deal",
                    estimated_impact="Prevent lead cooling",
                    reason=f"Created {int(round(age_hours))}h ago · no conversation linked",
                    due_label="Due today",
                    latest_touch_at=latest_touch,
                    suggested_status="contacted",
                )
            )

        # 3. Qualified leads without a meeting.
        if status == "qualified" and not next_meeting:
            rule_counts["qualified_needs_meeting"] = rule_counts.get("qualified_needs_meeting", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="qualified_needs_meeting",
                    rule_label="Qualified deal needs meeting",
                    priority="high",
                    title=f"Book next meeting with {lead.name}",
                    description="The deal is qualified but does not have a booked next step.",
                    cta_label="Schedule meeting",
                    estimated_impact=estimated_impact,
                    reason="Qualified stage · no upcoming appointment",
                    due_label="Due today",
                    latest_touch_at=latest_touch,
                )
            )

        # 4. Stage progression suggestion.
        if status in {"new", "contacted"} and intelligence.conversion_probability >= 68 and lead.score >= 68:
            suggested = "qualified"
            rule_counts["stage_progression"] = rule_counts.get("stage_progression", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="stage_progression",
                    rule_label="Stage progression",
                    priority="medium",
                    title=f"Review stage for {lead.name}",
                    description="Signals suggest this deal may be ready for the qualified stage.",
                    cta_label=f"Move to {STAGE_LABELS[suggested]}",
                    estimated_impact="Improve pipeline accuracy",
                    reason=f"Score {lead.score} · {intelligence.conversion_probability}% close chance",
                    due_label="Review today",
                    latest_touch_at=latest_touch,
                    suggested_status=suggested,
                )
            )

        # 5. Qualification gaps.
        if data_missing and status in {"new", "contacted", "qualified"}:
            missing_text = ", ".join(data_missing[:3])
            rule_counts["qualification_gap"] = rule_counts.get("qualification_gap", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="qualification_gap",
                    rule_label="Qualification gap",
                    priority="medium" if len(data_missing) <= 2 else "high",
                    title=f"Complete qualification for {lead.name}",
                    description=f"Missing {missing_text} makes AI scoring and forecasting less reliable.",
                    cta_label="Add details",
                    estimated_impact="Increase forecast confidence",
                    reason=f"Missing: {missing_text}",
                    due_label="Before next forecast",
                    latest_touch_at=latest_touch,
                )
            )

        # 6. Stage-specific stale deal warning.
        if hours_since_touch is None or hours_since_touch >= stale_limit:
            rule_counts["stale_pipeline"] = rule_counts.get("stale_pipeline", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="stale_pipeline",
                    rule_label="Stale pipeline warning",
                    priority="high" if status == "qualified" else "medium",
                    title=f"Revive {lead.name}",
                    description=f"This {STAGE_LABELS.get(status, status)} deal is past the stage follow-up window.",
                    cta_label="Open deal",
                    estimated_impact="Reduce pipeline risk",
                    reason=f"{_format_age(hours_since_touch)} · stage limit {stale_limit}h",
                    due_label="Overdue",
                    latest_touch_at=latest_touch,
                )
            )

        # 7. Meeting confirmation rule.
        if next_meeting and hours_until_meeting is not None and 0 <= hours_until_meeting <= 24:
            rule_counts["meeting_confirmation"] = rule_counts.get("meeting_confirmation", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="meeting_confirmation",
                    rule_label="Meeting confirmation",
                    priority="medium",
                    title=f"Confirm meeting with {lead.name}",
                    description="Send a short confirmation with agenda so the meeting does not slip.",
                    cta_label="Open deal",
                    estimated_impact="Protect meeting attendance",
                    reason=f"Meeting starts { _format_due(hours_until_meeting).lower() }",
                    due_label=_format_due(hours_until_meeting),
                    latest_touch_at=latest_touch,
                )
            )

        # 8. Completed meeting but deal not advanced.
        if completed and status != "won" and intelligence.conversion_probability >= 60:
            rule_counts["post_meeting_next_step"] = rule_counts.get("post_meeting_next_step", 0) + 1
            actions.append(
                _action(
                    lead=lead,
                    rule_id="post_meeting_next_step",
                    rule_label="Post-meeting next step",
                    priority="high",
                    title=f"Push next step for {lead.name}",
                    description="A meeting was completed, but the opportunity has not advanced yet.",
                    cta_label="Open deal",
                    estimated_impact="Convert meeting momentum",
                    reason=f"{len(completed)} completed meeting{'s' if len(completed) != 1 else ''}",
                    due_label="Due today",
                    latest_touch_at=latest_touch,
                )
            )

    actions.sort(
        key=lambda item: (
            _priority_rank(item.priority),
            1 if item.suggested_status else 0,
            item.latest_touch_at or datetime(1970, 1, 1, tzinfo=timezone.utc),
        ),
        reverse=True,
    )

    urgent_count = sum(1 for action in actions if action.priority == "urgent")
    high_count = sum(1 for action in actions if action.priority == "high")
    stale_count = rule_counts.get("stale_pipeline", 0) + rule_counts.get("hot_stale_followup", 0)
    suggested_stage_moves = sum(1 for action in actions if action.suggested_status)
    meetings_to_confirm = rule_counts.get("meeting_confirmation", 0)
    followups_due = rule_counts.get("hot_stale_followup", 0) + rule_counts.get("new_response_due", 0)

    automation_health = max(35, 100 - urgent_count * 14 - high_count * 7 - stale_count * 4)
    if not leads:
        automation_health = 0
        headline = "Add opportunities to activate pipeline automation."
    elif urgent_count:
        headline = f"{urgent_count} urgent automation rule{'s' if urgent_count != 1 else ''} need attention."
    elif high_count:
        headline = f"{high_count} high-priority pipeline action{'s' if high_count != 1 else ''} ready."
    elif actions:
        headline = "Pipeline automation is watching your next best actions."
    else:
        headline = "Pipeline automation is clean. No action needed right now."

    return PipelineAutomationResponse(
        generated_at=now,
        summary=PipelineAutomationSummary(
            total_actions=len(actions),
            urgent_count=urgent_count,
            high_priority_count=high_count,
            stale_count=stale_count,
            suggested_stage_moves=suggested_stage_moves,
            meetings_to_confirm=meetings_to_confirm,
            followups_due=followups_due,
            automation_health=automation_health,
            headline=headline,
        ),
        rules=_rule_catalog(rule_counts),
        actions=actions[:80],
    )
