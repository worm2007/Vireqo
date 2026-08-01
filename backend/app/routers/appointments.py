from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Business, Lead, User
from ..schemas import AppointmentCreate, AppointmentPublic
from ..security import get_current_user

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post("", response_model=AppointmentPublic, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)) -> Appointment:
    business = db.scalar(select(Business).where(Business.slug == payload.business_slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    if payload.lead_id:
        lead = db.scalar(select(Lead).where(Lead.id == payload.lead_id, Lead.business_id == business.id))
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

    appointment = Appointment(
        business_id=business.id,
        lead_id=payload.lead_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        starts_at=payload.starts_at,
        note=payload.note,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("", response_model=list[AppointmentPublic])
def list_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Appointment]:
    return list(
        db.scalars(
            select(Appointment)
            .where(Appointment.business_id == current_user.business_id)
            .order_by(desc(Appointment.starts_at))
        ).all()
    )
