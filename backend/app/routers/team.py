from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import TeamMemberCreate, TeamMemberUpdate, UserSummary
from ..security import hash_password, require_roles
from ..services.audit import record_audit

router = APIRouter(prefix="/team", tags=["Team"])


@router.get("", response_model=list[UserSummary])
def list_team(
    current_user: User = Depends(require_roles("owner", "admin", "member")),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(
        db.scalars(
            select(User).where(User.business_id == current_user.business_id).order_by(User.created_at)
        ).all()
    )


@router.post("", response_model=UserSummary, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: TeamMemberCreate,
    request: Request,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> User:
    email = str(payload.email).strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    member = User(
        business_id=current_user.business_id,
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(member)
    db.flush()
    record_audit(
        db,
        action="team.member_created",
        user=current_user,
        entity_type="user",
        entity_id=member.id,
        details={"role": member.role},
        request=request,
    )
    db.commit()
    db.refresh(member)
    return member


@router.patch("/{member_id}", response_model=UserSummary)
def update_member(
    member_id: str,
    payload: TeamMemberUpdate,
    request: Request,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> User:
    member = db.scalar(
        select(User).where(User.id == member_id, User.business_id == current_user.business_id)
    )
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.role == "owner" and member.id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can modify their own owner account")
    if member.id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    changes = payload.model_dump(exclude_unset=True)
    if member.role == "owner" and "role" in changes:
        owner_count = db.scalar(
            select(func.count(User.id)).where(
                User.business_id == current_user.business_id,
                User.role == "owner",
                User.is_active.is_(True),
            )
        ) or 0
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="A workspace must keep at least one active owner")

    for key, value in changes.items():
        setattr(member, key, value.strip() if isinstance(value, str) else value)
    record_audit(
        db,
        action="team.member_updated",
        user=current_user,
        entity_type="user",
        entity_id=member.id,
        details={"fields": list(changes)},
        request=request,
    )
    db.commit()
    db.refresh(member)
    return member
