from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Business, Lead, User, utcnow
from ..schemas import AppointmentCreate, AppointmentPublic, AppointmentUpdate
from ..security import get_current_user
from ..services.audit import record_audit

router = APIRouter(prefix="/appointments", tags=["Appointments"])


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def validate_slot(db: Session, business_id: str, starts_at: datetime, exclude_id: str | None = None) -> None:
    if aware(starts_at) <= utcnow():
        raise HTTPException(status_code=400, detail="Appointment time must be in the future")
    query = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.starts_at == starts_at,
        Appointment.status.in_(["booked", "confirmed"]),
    )
    if exclude_id:
        query = query.where(Appointment.id != exclude_id)
    if db.scalar(query):
        raise HTTPException(status_code=409, detail="This appointment slot is already booked")


@router.post("", response_model=AppointmentPublic, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)) -> Appointment:
    business = db.scalar(select(Business).where(Business.slug == payload.business_slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    lead = None
    if payload.lead_id:
        lead = db.scalar(
            select(Lead).where(Lead.id == payload.lead_id, Lead.business_id == business.id)
        )
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

    validate_slot(db, business.id, payload.starts_at)
    appointment = Appointment(
        business_id=business.id,
        lead_id=payload.lead_id,
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip(),
        starts_at=payload.starts_at,
        note=payload.note.strip(),
    )
    db.add(appointment)
    if lead and lead.status == "new":
        lead.status = "qualified"
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("", response_model=list[AppointmentPublic])
def list_appointments(
    status_filter: str | None = Query(default=None, alias="status"),
    upcoming_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Appointment]:
    query = select(Appointment).where(Appointment.business_id == current_user.business_id)
    if status_filter:
        query = query.where(Appointment.status == status_filter)
    if upcoming_only:
        query = query.where(Appointment.starts_at >= utcnow())
    return list(db.scalars(query.order_by(desc(Appointment.starts_at))).all())


@router.get("/{appointment_id}", response_model=AppointmentPublic)
def get_appointment(
    appointment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    appointment = db.scalar(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.business_id == current_user.business_id,
        )
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@router.patch("/{appointment_id}", response_model=AppointmentPublic)
def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    appointment = db.scalar(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.business_id == current_user.business_id,
        )
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    changes = payload.model_dump(exclude_unset=True)
    if payload.starts_at is not None:
        validate_slot(db, current_user.business_id, payload.starts_at, appointment.id)
    for key, value in changes.items():
        setattr(appointment, key, value.strip() if isinstance(value, str) else value)

    record_audit(
        db,
        action="appointment.updated",
        user=current_user,
        entity_type="appointment",
        entity_id=appointment.id,
        details={"fields": list(changes)},
        request=request,
    )
    db.commit()
    db.refresh(appointment)
    return appointment


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    appointment = db.scalar(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.business_id == current_user.business_id,
        )
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    record_audit(
        db,
        action="appointment.deleted",
        user=current_user,
        entity_type="appointment",
        entity_id=appointment.id,
        details={"name": appointment.name},
        request=request,
    )
    db.delete(appointment)
    db.commit()
