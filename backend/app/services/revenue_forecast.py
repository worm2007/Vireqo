from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Appointment, Conversation, Lead, User
from .lead_scoring import calculate_lead_intelligence, parse_budget_value

OPEN_STATUSES = {"new", "contacted", "qualified"}
CLOSED_STATUSES = {"won", "lost"}


@dataclass(frozen=True)
class ForecastOpportunity:
    lead_id: str
    name: str
    company: str
    status: str
    estimated_value: int
    weighted_value: int
    conversion_probability: int
    expected_window: str
    next_action: str


@dataclass(frozen=True)
class AtRiskLead:
    lead_id: str
    name: str
    company: str
    status: str
    estimated_value: int
    conversion_probability: int
    risk_level: str
    reason: str
    next_action: str


def _clamp(value: float | int, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, int(round(value))))


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _lower(value: Any) -> str:
    return _clean(value).lower()


def _utc(value: datetime | None) -> datetime | None:
    if not value:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _days_since(value: datetime | None) -> int | None:
    current = _utc(value)
    if not current:
        return None
    return max(0, (datetime.now(timezone.utc) - current).days)


def _format_inr(value: int | float) -> str:
    amount = int(round(value))
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.1f}Cr"
    if amount >= 100_000:
        return f"₹{amount / 100_000:.1f}L"
    if amount >= 1_000:
        return f"₹{amount / 1_000:.0f}K"
    return f"₹{amount}"


def _expected_window(timeline: str, created_at: datetime | None) -> str:
    text = _lower(timeline)
    if any(term in text for term in ("today", "tomorrow", "this week", "asap", "urgent", "immediate")):
        return "0-30 days"
    if any(term in text for term in ("week", "15 days", "30 days", "month")):
        return "0-30 days"
    if any(term in text for term in ("60", "2 month", "two month")):
        return "31-60 days"
    if any(term in text for term in ("90", "quarter", "3 month", "three month")):
        return "61-90 days"

    age_days = _days_since(created_at)
    if age_days is not None and age_days <= 14:
        return "0-30 days"
    return "Unscheduled"


def _default_budget(status: str, temperature: str) -> int:
    # Conservative defaults keep the forecast useful even while early users have
    # not entered budgets. Explicit lead budgets always override this value.
    if status == "qualified" or temperature == "hot":
        return 100_000
    if status == "contacted" or temperature == "warm":
        return 50_000
    return 25_000


def _risk_level(probability: int, days_stale: int | None, estimated_value: int, risk_count: int) -> str:
    if probability >= 62 and estimated_value >= 100_000 and (risk_count or (days_stale is not None and days_stale >= 7)):
        return "critical"
    if probability >= 45 and (risk_count or (days_stale is not None and days_stale >= 10)):
        return "high"
    return "medium"


def _risk_reason(*, risks: list[str], days_stale: int | None, missing_budget: bool, missing_timeline: bool) -> str:
    if days_stale is not None and days_stale >= 21:
        return "No recent activity for more than 21 days."
    if days_stale is not None and days_stale >= 7:
        return "Lead is cooling because it has not been updated this week."
    if missing_budget:
        return "Budget is missing, so the forecast confidence is lower."
    if missing_timeline:
        return "Timeline is unclear, so the expected close window is uncertain."
    if risks:
        return risks[0]
    return "Opportunity needs active follow-up to stay in forecast."


def _conversation_counts(db: Session, business_id: str, lead_ids: list[str]) -> dict[str, int]:
    if not lead_ids:
        return {}
    rows = db.execute(
        select(Conversation.lead_id, func.count(Conversation.id))
        .where(
            Conversation.business_id == business_id,
            Conversation.lead_id.in_(lead_ids),
        )
        .group_by(Conversation.lead_id)
    ).all()
    return {str(lead_id): int(count) for lead_id, count in rows if lead_id}


def _appointment_map(db: Session, business_id: str, lead_ids: list[str]) -> dict[str, list[Appointment]]:
    appointment_map: dict[str, list[Appointment]] = {lead_id: [] for lead_id in lead_ids}
    if not lead_ids:
        return appointment_map
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
    return appointment_map


def build_revenue_forecast(db: Session, current_user: User) -> dict[str, Any]:
    """Return deterministic revenue forecast and at-risk lead signals.

    Sprint 2.4.2 intentionally avoids migrations and paid AI calls. It uses the
    same predictive engine from Sprint 2.4.1 plus budget/timeline/status signals
    to estimate pipeline value, weighted forecast and revenue risk.
    """
    business_id = current_user.business_id
    leads = list(db.scalars(select(Lead).where(Lead.business_id == business_id)).all())
    lead_ids = [lead.id for lead in leads]
    appointment_map = _appointment_map(db, business_id, lead_ids)
    conversation_count_map = _conversation_counts(db, business_id, lead_ids)

    open_forecast: list[ForecastOpportunity] = []
    at_risk: list[AtRiskLead] = []
    stage_totals: dict[str, dict[str, int]] = {}
    bucket_totals: dict[str, dict[str, int]] = {
        "0-30 days": {"pipeline_value": 0, "weighted_value": 0, "count": 0},
        "31-60 days": {"pipeline_value": 0, "weighted_value": 0, "count": 0},
        "61-90 days": {"pipeline_value": 0, "weighted_value": 0, "count": 0},
        "Unscheduled": {"pipeline_value": 0, "weighted_value": 0, "count": 0},
    }

    total_pipeline_value = 0
    weighted_forecast = 0
    committed_value = 0
    at_risk_value = 0
    with_budget_count = 0
    missing_budget_count = 0
    high_value_count = 0
    hot_value = 0
    warm_value = 0
    cold_value = 0

    for lead in leads:
        status = _lower(lead.status) or "new"
        if status in CLOSED_STATUSES and status != "won":
            continue

        intelligence = calculate_lead_intelligence(
            lead=lead,
            appointments=appointment_map.get(lead.id, []),
            conversation_count=conversation_count_map.get(lead.id, 0),
        )
        explicit_budget = parse_budget_value(lead.budget)
        estimated_value = explicit_budget or _default_budget(status, intelligence.temperature)
        if explicit_budget:
            with_budget_count += 1
        elif status in OPEN_STATUSES:
            missing_budget_count += 1

        if estimated_value >= 100_000:
            high_value_count += 1

        weighted_value = int(round(estimated_value * intelligence.conversion_probability / 100))
        expected_window = _expected_window(lead.timeline, lead.created_at)

        if intelligence.temperature == "hot":
            hot_value += estimated_value
        elif intelligence.temperature == "warm":
            warm_value += estimated_value
        else:
            cold_value += estimated_value

        if status == "won":
            committed_value += estimated_value
            continue

        if status not in OPEN_STATUSES:
            continue

        total_pipeline_value += estimated_value
        weighted_forecast += weighted_value
        bucket_totals.setdefault(expected_window, {"pipeline_value": 0, "weighted_value": 0, "count": 0})
        bucket_totals[expected_window]["pipeline_value"] += estimated_value
        bucket_totals[expected_window]["weighted_value"] += weighted_value
        bucket_totals[expected_window]["count"] += 1

        stage_totals.setdefault(status, {"pipeline_value": 0, "weighted_value": 0, "count": 0})
        stage_totals[status]["pipeline_value"] += estimated_value
        stage_totals[status]["weighted_value"] += weighted_value
        stage_totals[status]["count"] += 1

        opportunity = ForecastOpportunity(
            lead_id=lead.id,
            name=lead.name,
            company=lead.company,
            status=status,
            estimated_value=estimated_value,
            weighted_value=weighted_value,
            conversion_probability=intelligence.conversion_probability,
            expected_window=expected_window,
            next_action=intelligence.next_action,
        )
        open_forecast.append(opportunity)

        days_stale = _days_since(lead.updated_at)
        missing_budget = not bool(explicit_budget)
        missing_timeline = not bool(_clean(lead.timeline))
        risk_count = len(intelligence.risks)
        is_stale = days_stale is not None and days_stale >= 7
        is_forecast_risk = (
            weighted_value >= 25_000
            and intelligence.conversion_probability >= 35
            and (risk_count > 0 or is_stale or missing_budget or missing_timeline)
        )
        if is_forecast_risk:
            risk = AtRiskLead(
                lead_id=lead.id,
                name=lead.name,
                company=lead.company,
                status=status,
                estimated_value=estimated_value,
                conversion_probability=intelligence.conversion_probability,
                risk_level=_risk_level(intelligence.conversion_probability, days_stale, estimated_value, risk_count),
                reason=_risk_reason(
                    risks=intelligence.risks,
                    days_stale=days_stale,
                    missing_budget=missing_budget,
                    missing_timeline=missing_timeline,
                ),
                next_action=intelligence.next_action,
            )
            at_risk.append(risk)
            at_risk_value += weighted_value

    open_forecast.sort(key=lambda item: (item.weighted_value, item.conversion_probability), reverse=True)
    at_risk.sort(
        key=lambda item: (
            2 if item.risk_level == "critical" else 1 if item.risk_level == "high" else 0,
            item.estimated_value,
            item.conversion_probability,
        ),
        reverse=True,
    )

    likely_this_month = bucket_totals.get("0-30 days", {}).get("weighted_value", 0)
    budget_coverage = (with_budget_count / len(leads) * 100) if leads else 0
    forecast_confidence = _clamp(
        38
        + min(24, len(open_forecast) * 3)
        + budget_coverage * 0.28
        - min(20, missing_budget_count * 3)
        - min(18, len(at_risk) * 2)
    )

    if not leads:
        recommendation = "Add qualified opportunities with budget and timeline to unlock the revenue forecast."
        forecast_label = "Waiting for pipeline data"
    elif len(at_risk) >= 3:
        recommendation = "Recover at-risk revenue before adding more cold opportunities."
        forecast_label = "Revenue needs attention"
    elif likely_this_month:
        recommendation = "Focus on the 0-30 day opportunities with the highest weighted value."
        forecast_label = "Forecast active"
    else:
        recommendation = "Add timelines to open opportunities so Vireqo can forecast close windows more accurately."
        forecast_label = "Timeline data needed"

    return {
        "generated_at": datetime.now(timezone.utc),
        "currency": "INR",
        "summary": {
            "pipeline_value": total_pipeline_value,
            "pipeline_value_label": _format_inr(total_pipeline_value),
            "weighted_forecast": weighted_forecast,
            "weighted_forecast_label": _format_inr(weighted_forecast),
            "likely_this_month": likely_this_month,
            "likely_this_month_label": _format_inr(likely_this_month),
            "at_risk_value": at_risk_value,
            "at_risk_value_label": _format_inr(at_risk_value),
            "committed_value": committed_value,
            "committed_value_label": _format_inr(committed_value),
            "forecast_confidence": forecast_confidence,
            "forecast_label": forecast_label,
            "recommendation": recommendation,
        },
        "signals": {
            "open_leads_count": len(open_forecast),
            "with_budget_count": with_budget_count,
            "missing_budget_count": missing_budget_count,
            "high_value_count": high_value_count,
            "at_risk_count": len(at_risk),
            "hot_value": hot_value,
            "warm_value": warm_value,
            "cold_value": cold_value,
        },
        "stage_forecast": [
            {
                "stage": stage,
                "count": values["count"],
                "pipeline_value": values["pipeline_value"],
                "weighted_value": values["weighted_value"],
                "pipeline_value_label": _format_inr(values["pipeline_value"]),
                "weighted_value_label": _format_inr(values["weighted_value"]),
            }
            for stage, values in sorted(stage_totals.items(), key=lambda item: item[1]["weighted_value"], reverse=True)
        ],
        "monthly_buckets": [
            {
                "window": window,
                "count": values["count"],
                "pipeline_value": values["pipeline_value"],
                "weighted_value": values["weighted_value"],
                "pipeline_value_label": _format_inr(values["pipeline_value"]),
                "weighted_value_label": _format_inr(values["weighted_value"]),
            }
            for window, values in bucket_totals.items()
        ],
        "forecast_opportunities": [
            {
                "lead_id": item.lead_id,
                "name": item.name,
                "company": item.company,
                "status": item.status,
                "estimated_value": item.estimated_value,
                "estimated_value_label": _format_inr(item.estimated_value),
                "weighted_value": item.weighted_value,
                "weighted_value_label": _format_inr(item.weighted_value),
                "conversion_probability": item.conversion_probability,
                "expected_window": item.expected_window,
                "next_action": item.next_action,
            }
            for item in open_forecast[:8]
        ],
        "at_risk_leads": [
            {
                "lead_id": item.lead_id,
                "name": item.name,
                "company": item.company,
                "status": item.status,
                "estimated_value": item.estimated_value,
                "estimated_value_label": _format_inr(item.estimated_value),
                "conversion_probability": item.conversion_probability,
                "risk_level": item.risk_level,
                "reason": item.reason,
                "next_action": item.next_action,
            }
            for item in at_risk[:8]
        ],
    }
