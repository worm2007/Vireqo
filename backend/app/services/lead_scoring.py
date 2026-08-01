from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LeadScore:
    score: int
    temperature: str


def calculate_lead_score(
    *,
    need: str = "",
    budget: str = "",
    timeline: str = "",
    email: str = "",
    phone: str = "",
) -> LeadScore:
    text = " ".join([need, budget, timeline]).lower()
    score = 25

    if len(need.strip()) >= 20:
        score += 15
    if email:
        score += 10
    if phone:
        score += 12
    if budget:
        score += 12
    if timeline:
        score += 10

    high_intent = ("urgent", "this week", "today", "ready", "book", "demo", "quote", "buy", "start")
    medium_intent = ("month", "pricing", "cost", "interested", "information", "consult")
    if any(term in text for term in high_intent):
        score += 18
    elif any(term in text for term in medium_intent):
        score += 10

    score = min(score, 100)
    temperature = "hot" if score >= 72 else "warm" if score >= 45 else "cold"
    return LeadScore(score=score, temperature=temperature)
