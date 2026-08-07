from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable


@dataclass(frozen=True)
class LeadScore:
    score: int
    temperature: str


@dataclass(frozen=True)
class LeadIntelligence:
    lead_id: str
    score: int
    temperature: str
    conversion_probability: int
    conversion_label: str
    confidence: int
    next_action: str
    next_action_priority: str
    reasons: list[str]
    risks: list[str]
    signals: dict[str, int]
    score_breakdown: dict[str, int]
    estimated_budget_value: int | None


def _clamp(value: float | int, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, int(round(value))))


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _lower(value: Any) -> str:
    return _clean(value).lower()


def _contains_any(text: str, terms: Iterable[str]) -> bool:
    return any(term in text for term in terms)


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


def parse_budget_value(value: str) -> int | None:
    """Return an approximate rupee value from free-text budget data.

    This intentionally stays heuristic so Sprint 2.4.1 works without a DB migration
    or paid enrichment API. It understands common Indian formats such as 50k,
    2 lakh, 3.5L, 1 crore and ordinary rupee numbers.
    """
    text = _lower(value)
    if not text:
        return None

    normalized = text.replace(",", "").replace("₹", "rs ").replace("inr", "rs")
    numbers = [float(match) for match in re.findall(r"\d+(?:\.\d+)?", normalized)]
    if not numbers:
        return None

    multiplier = 1
    if re.search(r"\b(cr|crore|crores)\b", normalized):
        multiplier = 10_000_000
    elif re.search(r"\b(l|lac|lakh|lakhs)\b", normalized):
        multiplier = 100_000
    elif re.search(r"\b(k|thousand)\b", normalized):
        multiplier = 1_000

    return int(max(numbers) * multiplier)


def _temperature(score: int) -> str:
    if score >= 74:
        return "hot"
    if score >= 48:
        return "warm"
    return "cold"


def _conversion_label(probability: int) -> str:
    if probability >= 80:
        return "Very likely"
    if probability >= 62:
        return "Likely"
    if probability >= 42:
        return "Needs nurture"
    return "Low intent"


def _priority(score: int, probability: int, risks: list[str]) -> str:
    if score >= 80 or probability >= 75 or risks:
        return "high"
    if score >= 58 or probability >= 50:
        return "medium"
    return "normal"


def calculate_lead_score(
    *,
    need: str = "",
    budget: str = "",
    timeline: str = "",
    email: str = "",
    phone: str = "",
) -> LeadScore:
    # Backwards-compatible lightweight API used during lead capture.
    intelligence = calculate_lead_intelligence(
        lead={
            "id": "preview",
            "need": need,
            "budget": budget,
            "timeline": timeline,
            "email": email,
            "phone": phone,
            "company": "",
            "source": "",
            "status": "new",
            "notes": "",
            "created_at": None,
            "updated_at": None,
        },
        appointments=[],
    )
    return LeadScore(score=intelligence.score, temperature=intelligence.temperature)


def calculate_lead_intelligence(
    *,
    lead: Any,
    appointments: list[Any] | None = None,
    conversation_count: int = 0,
) -> LeadIntelligence:
    appointments = appointments or []

    get = lead.get if isinstance(lead, dict) else lambda name, default=None: getattr(lead, name, default)

    lead_id = _clean(get("id", ""))
    name = _clean(get("name", "this lead")) or "this lead"
    email = _clean(get("email", ""))
    phone = _clean(get("phone", ""))
    company = _clean(get("company", ""))
    need = _clean(get("need", ""))
    budget = _clean(get("budget", ""))
    timeline = _clean(get("timeline", ""))
    source = _clean(get("source", ""))
    status = _lower(get("status", "new")) or "new"
    notes = _clean(get("notes", ""))
    created_at = _utc(get("created_at", None))
    updated_at = _utc(get("updated_at", None)) or created_at

    text = " ".join([need, budget, timeline, source, notes]).lower()
    reasons: list[str] = []
    risks: list[str] = []
    breakdown: dict[str, int] = {}

    # 1) Data completeness.
    completeness = 0
    if email:
        completeness += 8
    if phone:
        completeness += 8
    if company:
        completeness += 5
    if len(need) >= 18:
        completeness += 10
    elif need:
        completeness += 5
    if budget:
        completeness += 9
    if timeline:
        completeness += 7
    if notes:
        completeness += 3
    breakdown["data_quality"] = min(completeness, 50)
    if completeness >= 35:
        reasons.append("Strong qualification data is already captured.")
    elif completeness <= 14:
        risks.append("Important contact or qualification details are missing.")

    # 2) Intent language.
    high_intent_terms = (
        "urgent",
        "today",
        "this week",
        "ready",
        "book",
        "demo",
        "quote",
        "buy",
        "start",
        "proposal",
        "pricing",
        "purchase",
        "implement",
    )
    medium_intent_terms = (
        "month",
        "cost",
        "interested",
        "information",
        "consult",
        "compare",
        "plan",
        "requirements",
    )
    negative_terms = ("later", "not now", "just checking", "maybe", "no budget", "student", "free")
    intent = 0
    if _contains_any(text, high_intent_terms):
        intent += 20
        reasons.append("Lead language shows high buying intent.")
    elif _contains_any(text, medium_intent_terms):
        intent += 11
        reasons.append("Lead has shown active evaluation intent.")
    if _contains_any(text, negative_terms):
        intent -= 12
        risks.append("Lead language suggests hesitation or weak urgency.")
    breakdown["intent"] = intent

    # 3) Budget signal.
    estimated_budget = parse_budget_value(budget)
    budget_signal = 0
    if estimated_budget and estimated_budget >= 500_000:
        budget_signal = 15
        reasons.append("Budget indicates a high-value opportunity.")
    elif estimated_budget and estimated_budget >= 100_000:
        budget_signal = 12
        reasons.append("Budget is meaningful enough to prioritize.")
    elif estimated_budget and estimated_budget >= 25_000:
        budget_signal = 8
    elif budget:
        budget_signal = 5
    else:
        risks.append("No budget is attached yet.")
    breakdown["budget"] = budget_signal

    # 4) Timeline urgency.
    timeline_signal = 0
    timeline_text = timeline.lower()
    if _contains_any(timeline_text, ("today", "tomorrow", "this week", "urgent", "asap", "immediate")):
        timeline_signal = 12
        reasons.append("Timeline is urgent.")
    elif _contains_any(timeline_text, ("week", "15 days", "30 days", "month")):
        timeline_signal = 7
    elif timeline:
        timeline_signal = 3
    else:
        risks.append("Timeline is not clear.")
    breakdown["timeline"] = timeline_signal

    # 5) Pipeline status.
    status_signal_map = {
        "new": 2,
        "contacted": 9,
        "qualified": 18,
        "won": 28,
        "lost": -30,
    }
    status_signal = status_signal_map.get(status, 0)
    breakdown["pipeline_stage"] = status_signal
    if status == "qualified":
        reasons.append("Lead is already qualified in the pipeline.")
    elif status == "won":
        reasons.append("Lead is marked won.")
    elif status == "lost":
        risks.append("Lead is currently marked lost.")

    # 6) Source strength.
    source_text = source.lower()
    source_signal = 0
    if _contains_any(source_text, ("referral", "partner", "inbound")):
        source_signal = 8
    elif _contains_any(source_text, ("website", "chatbot", "demo", "landing")):
        source_signal = 6
    elif _contains_any(source_text, ("instagram", "linkedin", "ad", "campaign")):
        source_signal = 5
    elif source:
        source_signal = 3
    breakdown["source"] = source_signal

    # 7) Appointment and conversation signals.
    appointment_signal = 0
    now = datetime.now(timezone.utc)
    future_meetings = []
    completed_meetings = 0
    cancelled_meetings = 0
    for appointment in appointments:
        status_value = _lower(getattr(appointment, "status", ""))
        starts_at = _utc(getattr(appointment, "starts_at", None))
        if status_value in {"booked", "confirmed"} and starts_at and starts_at >= now:
            future_meetings.append(appointment)
        if status_value == "completed":
            completed_meetings += 1
        if status_value in {"cancelled", "no_show"}:
            cancelled_meetings += 1
    if future_meetings:
        appointment_signal += 16
        reasons.append("A future meeting is already booked.")
    if completed_meetings:
        appointment_signal += min(12, completed_meetings * 8)
        reasons.append("Past meeting activity increases close probability.")
    if cancelled_meetings:
        appointment_signal -= min(14, cancelled_meetings * 8)
        risks.append("Cancelled or missed meeting activity needs recovery.")
    if conversation_count:
        appointment_signal += min(6, conversation_count * 2)
    breakdown["engagement"] = appointment_signal

    # 8) Freshness.
    age_days = _days_since(updated_at)
    recency_signal = 0
    if age_days is None:
        recency_signal = 2
    elif age_days <= 2:
        recency_signal = 8
    elif age_days <= 7:
        recency_signal = 5
    elif age_days <= 21:
        recency_signal = 1
    else:
        recency_signal = -10
        risks.append("Lead has not been updated for more than 21 days.")
    breakdown["recency"] = recency_signal

    raw_score = 22 + sum(breakdown.values())
    score = _clamp(raw_score)
    temperature = _temperature(score)

    base_probability = {
        "new": 18,
        "contacted": 34,
        "qualified": 62,
        "won": 100,
        "lost": 5,
    }.get(status, 24)
    conversion = base_probability
    conversion += max(0, score - 50) * 0.45
    conversion += 10 if future_meetings else 0
    conversion += 8 if estimated_budget else 0
    conversion += 5 if email and phone else 0
    conversion += 4 if age_days is not None and age_days <= 3 else 0
    conversion -= 12 if not budget else 0
    conversion -= 8 if not timeline else 0
    conversion -= 9 if risks else 0
    conversion_probability = _clamp(conversion)

    if status == "won":
        next_action = f"Move {name} into onboarding and capture expansion notes."
    elif status == "lost":
        next_action = f"Review why {name} was lost and decide whether to archive or revive later."
    elif not email and not phone:
        next_action = f"Collect a reliable contact method for {name}."
    elif not budget:
        next_action = f"Ask {name} for budget range before sending a proposal."
    elif future_meetings:
        next_action = f"Prepare a meeting brief for {name} before the scheduled call."
    elif status == "qualified" or conversion_probability >= 65:
        next_action = f"Send a tailored pricing or proposal follow-up to {name}."
    elif age_days is not None and age_days >= 7:
        next_action = f"Follow up with {name} today before the opportunity cools further."
    else:
        next_action = f"Send a short personalized follow-up to move {name} to the next stage."

    available_fields = sum(
        bool(item)
        for item in [email, phone, company, need, budget, timeline, source, status, notes]
    )
    confidence = _clamp(36 + available_fields * 6 + min(18, len(appointments) * 6) + min(8, conversation_count * 2))

    if not reasons:
        reasons.append("Prediction is based on current CRM stage and captured lead fields.")
    if not risks and conversion_probability < 70:
        risks.append("Lead still needs stronger qualification before high-confidence closing.")

    signals = {
        "data_quality": _clamp(completeness * 2),
        "intent_strength": _clamp(50 + intent * 2),
        "budget_strength": _clamp(budget_signal * 6),
        "timeline_urgency": _clamp(timeline_signal * 7),
        "engagement": _clamp(50 + appointment_signal * 3),
        "freshness": _clamp(50 + recency_signal * 4),
    }

    return LeadIntelligence(
        lead_id=lead_id,
        score=score,
        temperature=temperature,
        conversion_probability=conversion_probability,
        conversion_label=_conversion_label(conversion_probability),
        confidence=confidence,
        next_action=next_action,
        next_action_priority=_priority(score, conversion_probability, risks),
        reasons=reasons[:4],
        risks=risks[:3],
        signals=signals,
        score_breakdown={key: int(value) for key, value in breakdown.items()},
        estimated_budget_value=estimated_budget,
    )
