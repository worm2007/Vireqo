from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business, Lead, User
from ..schemas import LeadCreate, LeadPublic, LeadUpdate
from ..security import get_current_user
from ..services.lead_scoring import calculate_lead_score

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.post("/capture/{business_slug}", response_model=LeadPublic, status_code=status.HTTP_201_CREATED)
def capture_lead(business_slug: str, payload: LeadCreate, db: Session = Depends(get_db)) -> Lead:
    business = db.scalar(select(Business).where(Business.slug == business_slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    result = calculate_lead_score(
        need=payload.need,
        budget=payload.budget,
        timeline=payload.timeline,
        email=payload.email,
        phone=payload.phone,
    )
    lead = Lead(
        business_id=business.id,
        **payload.model_dump(),
        score=result.score,
        temperature=result.temperature,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("", response_model=list[LeadPublic])
def list_leads(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Lead]:
    query = select(Lead).where(Lead.business_id == current_user.business_id)
    if status_filter:
        query = query.where(Lead.status == status_filter)
    return list(db.scalars(query.order_by(desc(Lead.created_at)).limit(limit)).all())


@router.patch("/{lead_id}", response_model=LeadPublic)
def update_lead(
    lead_id: str,
    payload: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Lead:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.business_id == current_user.business_id))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)
    if payload.score is not None:
        lead.temperature = "hot" if payload.score >= 72 else "warm" if payload.score >= 45 else "cold"
    db.commit()
    db.refresh(lead)
    return lead
