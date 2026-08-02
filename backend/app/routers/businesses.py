from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business, User
from ..schemas import BusinessPublic, BusinessUpdate
from ..security import get_current_user, require_roles
from ..services.audit import record_audit

router = APIRouter(prefix="/businesses", tags=["Businesses"])


@router.get("/me", response_model=BusinessPublic)
def get_my_business(current_user: User = Depends(get_current_user)) -> Business:
    return current_user.business


@router.patch("/me", response_model=BusinessPublic)
def update_my_business(
    payload: BusinessUpdate,
    request: Request,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> Business:
    business = current_user.business
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(business, key, value.strip() if isinstance(value, str) else value)
    record_audit(
        db,
        action="business.updated",
        user=current_user,
        entity_type="business",
        entity_id=business.id,
        details={"fields": list(changes)},
        request=request,
    )
    db.commit()
    db.refresh(business)
    return business


@router.get("/{slug}", response_model=BusinessPublic)
def get_business(slug: str, db: Session = Depends(get_db)) -> Business:
    business = db.scalar(select(Business).where(Business.slug == slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business
