from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business, Lead, User
from ..schemas import LeadCreate, LeadDetailResponse, LeadPublic, LeadUpdate
from ..security import get_current_user
from ..services.audit import record_audit
from ..services.lead_activity import build_lead_detail
from ..services.lead_scoring import calculate_lead_score
from ..services.realtime import workspace_events

router = APIRouter(prefix="/leads", tags=["Leads"])


def apply_score(lead: Lead, explicit_score: int | None = None) -> None:
    if explicit_score is not None:
        lead.score = explicit_score
        lead.temperature = "hot" if explicit_score >= 72 else "warm" if explicit_score >= 45 else "cold"
        return
    result = calculate_lead_score(
        need=lead.need,
        budget=lead.budget,
        timeline=lead.timeline,
        email=lead.email,
        phone=lead.phone,
    )
    lead.score = result.score
    lead.temperature = result.temperature


@router.post("/capture/{business_slug}", response_model=LeadPublic, status_code=status.HTTP_201_CREATED)
def capture_lead(business_slug: str, payload: LeadCreate, db: Session = Depends(get_db)) -> Lead:
    business = db.scalar(select(Business).where(Business.slug == business_slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    email = payload.email.strip().lower()
    lead = None
    if email:
        lead = db.scalar(
            select(Lead).where(Lead.business_id == business.id, func.lower(Lead.email) == email)
        )

    if lead:
        incoming = payload.model_dump()
        for key, value in incoming.items():
            if isinstance(value, str) and value.strip():
                setattr(lead, key, value.strip())
        lead.email = email
        apply_score(lead)
    else:
        lead = Lead(business_id=business.id, **payload.model_dump())
        lead.email = email
        apply_score(lead)
        db.add(lead)

    db.commit()
    db.refresh(lead)
    return lead


@router.post("", response_model=LeadPublic, status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Lead:
    lead = Lead(business_id=current_user.business_id, **payload.model_dump())
    lead.email = lead.email.strip().lower()
    apply_score(lead)
    db.add(lead)
    db.flush()
    record_audit(
        db,
        action="lead.created",
        user=current_user,
        entity_type="lead",
        entity_id=lead.id,
        request=request,
    )
    db.commit()
    db.refresh(lead)
    workspace_events.publish(lead.business_id, "lead.created", {"id": lead.id, "name": lead.name, "status": lead.status, "score": lead.score})
    return lead


@router.get("", response_model=list[LeadPublic])
def list_leads(
    response: Response,
    status_filter: str | None = Query(default=None, alias="status"),
    temperature: str | None = Query(default=None, pattern="^(hot|warm|cold)$"),
    search: str | None = Query(default=None, max_length=200),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Lead]:
    conditions = [Lead.business_id == current_user.business_id]
    if status_filter:
        conditions.append(Lead.status == status_filter)
    if temperature:
        conditions.append(Lead.temperature == temperature)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                Lead.name.ilike(term),
                Lead.email.ilike(term),
                Lead.phone.ilike(term),
                Lead.company.ilike(term),
                Lead.need.ilike(term),
            )
        )

    total = db.scalar(select(func.count(Lead.id)).where(*conditions)) or 0
    response.headers["X-Total-Count"] = str(total)
    return list(
        db.scalars(
            select(Lead)
            .where(*conditions)
            .order_by(desc(Lead.created_at))
            .offset(offset)
            .limit(limit)
        ).all()
    )


@router.get("/{lead_id}/activity", response_model=LeadDetailResponse)
def get_lead_activity(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeadDetailResponse:
    """Return a deal detail view with timeline, meetings, AI prediction and audit activity."""
    return build_lead_detail(db, current_user, lead_id)


@router.get("/{lead_id}", response_model=LeadPublic)
def get_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Lead:
    lead = db.scalar(
        select(Lead).where(Lead.id == lead_id, Lead.business_id == current_user.business_id)
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadPublic)
def update_lead(
    lead_id: str,
    payload: LeadUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Lead:
    lead = db.scalar(
        select(Lead).where(Lead.id == lead_id, Lead.business_id == current_user.business_id)
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    changes = payload.model_dump(exclude_unset=True)
    explicit_score = changes.pop("score", None)
    for key, value in changes.items():
        setattr(lead, key, value.strip() if isinstance(value, str) else value)

    scoring_fields = {"email", "phone", "need", "budget", "timeline"}
    if explicit_score is not None or scoring_fields.intersection(changes):
        apply_score(lead, explicit_score)

    record_audit(
        db,
        action="lead.updated",
        user=current_user,
        entity_type="lead",
        entity_id=lead.id,
        details={"fields": list(payload.model_dump(exclude_unset=True))},
        request=request,
    )
    db.commit()
    db.refresh(lead)
    workspace_events.publish(lead.business_id, "lead.updated", {"id": lead.id, "name": lead.name, "status": lead.status, "score": lead.score})
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    lead = db.scalar(
        select(Lead).where(Lead.id == lead_id, Lead.business_id == current_user.business_id)
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    record_audit(
        db,
        action="lead.deleted",
        user=current_user,
        entity_type="lead",
        entity_id=lead.id,
        details={"name": lead.name},
        request=request,
    )
    business_id = lead.business_id
    payload = {"id": lead.id, "name": lead.name}
    db.delete(lead)
    db.commit()
    workspace_events.publish(business_id, "lead.deleted", payload)
