from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Lead, User
from ..schemas import AnalyticsSummary, LeadPublic
from ..security import get_current_user
from ..services.executive_insights import build_executive_insights

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
