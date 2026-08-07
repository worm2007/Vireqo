from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Conversation, Lead, User
from ..schemas import AnalyticsSummary, LeadIntelligenceResponse, LeadIntelligenceSummary, LeadPrediction, LeadPublic
from ..security import get_current_user
from ..services.executive_insights import build_executive_insights
from ..services.lead_scoring import calculate_lead_intelligence

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsSummary:
    business_id = current_user.business_id
    total = db.scalar(select(func.count(Lead.id)).where(Lead.business_id == business_id)) or 0
    new = db.scalar(select(func.count(Lead.id)).where(Lead.business_id == business_id, Lead.status == "new")) or 0
    qualified = db.scalar(
        select(func.count(Lead.id)).where(Lead.business_id == business_id, Lead.status.in_(["qualified", "won"]))
    ) or 0
    won = db.scalar(select(func.count(Lead.id)).where(Lead.business_id == business_id, Lead.status == "won")) or 0
    appointments = db.scalar(select(func.count(Appointment.id)).where(Appointment.business_id == business_id)) or 0
    average_score = db.scalar(select(func.avg(Lead.score)).where(Lead.business_id == business_id)) or 0

    rows = db.execute(
        select(Lead.temperature, func.count(Lead.id))
        .where(Lead.business_id == business_id)
        .group_by(Lead.temperature)
    ).all()
    temperatures = {"hot": 0, "warm": 0, "cold": 0}
    temperatures.update({name: count for name, count in rows})

    recent = list(
        db.scalars(
            select(Lead).where(Lead.business_id == business_id).order_by(desc(Lead.created_at)).limit(6)
        ).all()
    )
    return AnalyticsSummary(
        total_leads=total,
        new_leads=new,
        qualified_leads=qualified,
        won_leads=won,
        appointments=appointments,
        conversion_rate=round((won / total * 100) if total else 0, 1),
        average_score=round(float(average_score), 1),
        temperatures=temperatures,
        recent_leads=[LeadPublic.model_validate(item) for item in recent],
    )


@router.get("/insights")
def executive_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Return deterministic, workspace-scoped executive intelligence."""
    return build_executive_insights(db, current_user)


@router.get("/lead-intelligence", response_model=LeadIntelligenceResponse)
def lead_intelligence(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeadIntelligenceResponse:
    """Return predictive scoring and conversion intelligence for current workspace leads."""
    business_id = current_user.business_id
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
            select(Conversation.lead_id, func.count(Conversation.id))
            .where(
                Conversation.business_id == business_id,
                Conversation.lead_id.in_(lead_ids),
            )
            .group_by(Conversation.lead_id)
        ).all()
        conversation_count_map.update({str(lead_id): int(count) for lead_id, count in conversation_rows if lead_id})

    predictions = [
        calculate_lead_intelligence(
            lead=lead,
            appointments=appointment_map.get(lead.id, []),
            conversation_count=conversation_count_map.get(lead.id, 0),
        )
        for lead in leads
    ]
    predictions.sort(
        key=lambda item: (
            item.conversion_probability,
            item.score,
            1 if item.next_action_priority == "high" else 0,
        ),
        reverse=True,
    )

    if predictions:
        average_score = round(sum(item.score for item in predictions) / len(predictions), 1)
        average_conversion = round(
            sum(item.conversion_probability for item in predictions) / len(predictions), 1
        )
        high_intent_count = sum(1 for item in predictions if item.score >= 74 or item.conversion_probability >= 70)
        at_risk_count = sum(1 for item in predictions if item.risks and item.conversion_probability < 65)
        best = predictions[0]
        if high_intent_count:
            focus = "Prioritize the highest-conversion leads before adding more new leads."
        elif at_risk_count:
            focus = "Recover at-risk leads with fast follow-ups and clearer qualification."
        else:
            focus = "Improve lead quality by collecting budget, timeline and contact details."
        best_id = best.lead_id
    else:
        average_score = 0.0
        average_conversion = 0.0
        high_intent_count = 0
        at_risk_count = 0
        best_id = None
        focus = "Add leads with budget, timeline and source details to unlock predictions."

    return LeadIntelligenceResponse(
        generated_at=datetime.now(timezone.utc),
        summary=LeadIntelligenceSummary(
            average_score=average_score,
            average_conversion_probability=average_conversion,
            high_intent_count=high_intent_count,
            at_risk_count=at_risk_count,
            best_opportunity_id=best_id,
            recommended_focus=focus,
        ),
        predictions=[
            LeadPrediction(
                lead_id=item.lead_id,
                score=item.score,
                temperature=item.temperature,
                conversion_probability=item.conversion_probability,
                conversion_label=item.conversion_label,
                confidence=item.confidence,
                next_action=item.next_action,
                next_action_priority=item.next_action_priority,
                reasons=item.reasons,
                risks=item.risks,
                signals=item.signals,
                score_breakdown=item.score_breakdown,
                estimated_budget_value=item.estimated_budget_value,
            )
            for item in predictions
        ],
    )
