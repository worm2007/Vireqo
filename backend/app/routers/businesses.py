from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business
from ..schemas import BusinessPublic

router = APIRouter(prefix="/businesses", tags=["Businesses"])


@router.get("/{slug}", response_model=BusinessPublic)
def get_business(slug: str, db: Session = Depends(get_db)) -> Business:
    business = db.scalar(select(Business).where(Business.slug == slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business
