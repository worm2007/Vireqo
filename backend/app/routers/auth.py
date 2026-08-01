from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Business, User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "business"


def token_response(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(user.id), user=UserPublic.model_validate(user))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    base_slug = slugify(payload.business_name)
    slug = base_slug
    suffix = 2
    while db.scalar(select(Business).where(Business.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    business = Business(name=payload.business_name.strip(), slug=slug, industry=payload.industry.strip())
    db.add(business)
    db.flush()
    user = User(
        business_id=business.id,
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()

    user = db.scalar(select(User).options(selectinload(User.business)).where(User.id == user.id))
    assert user is not None
    return token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(
        select(User).options(selectinload(User.business)).where(User.email == payload.email.strip().lower())
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return token_response(user)


@router.post("/demo", response_model=TokenResponse)
def demo_login(db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).options(selectinload(User.business)).where(User.email == "demo@vireqo.local"))
    if not user:
        raise HTTPException(status_code=404, detail="Demo account is unavailable")
    return token_response(user)
