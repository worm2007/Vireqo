from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database import get_db
from ..models import AuthToken, Business, User, utcnow
from ..schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserPublic,
)
from ..security import (
    create_access_token,
    generate_opaque_token,
    get_current_user,
    hash_opaque_token,
    hash_password,
    verify_password,
)
from ..services.audit import record_audit
from ..services.email import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "business"


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def load_user(db: Session, user_id: str) -> User | None:
    return db.scalar(select(User).options(selectinload(User.business)).where(User.id == user_id))


def issue_token_pair(db: Session, user: User) -> TokenResponse:
    raw_refresh = generate_opaque_token()
    db.add(
        AuthToken(
            user_id=user.id,
            purpose="refresh",
            token_hash=hash_opaque_token(raw_refresh),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        )
    )
    db.flush()
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=raw_refresh,
        expires_in=settings.access_token_minutes * 60,
        user=UserPublic.model_validate(user),
    )


def revoke_user_tokens(db: Session, user_id: str, purpose: str | None = None) -> None:
    conditions = [AuthToken.user_id == user_id, AuthToken.revoked_at.is_(None)]
    if purpose:
        conditions.append(AuthToken.purpose == purpose)
    db.execute(update(AuthToken).where(*conditions).values(revoked_at=utcnow()))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    email = str(payload.email).strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    base_slug = slugify(payload.business_name)
    slug = base_slug
    suffix = 2
    while db.scalar(select(Business).where(Business.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    business = Business(
        name=payload.business_name.strip(),
        slug=slug,
        industry=payload.industry.strip(),
    )
    db.add(business)
    db.flush()
    user = User(
        business_id=business.id,
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="owner",
    )
    db.add(user)
    db.flush()
    user = load_user(db, user.id)
    assert user is not None
    response = issue_token_pair(db, user)
    record_audit(
        db,
        action="auth.register",
        user=user,
        entity_type="user",
        entity_id=user.id,
        request=request,
    )
    db.commit()
    return response


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).options(selectinload(User.business)).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is inactive")

    response = issue_token_pair(db, user)
    record_audit(db, action="auth.login", user=user, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return response


@router.post("/demo", response_model=TokenResponse)
def demo_login(request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).options(selectinload(User.business)).where(User.email == "demo@vireqo.app"))
    if not user:
        raise HTTPException(status_code=404, detail="Demo account is unavailable")
    response = issue_token_pair(db, user)
    record_audit(db, action="auth.demo_login", user=user, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return response


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    token = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_opaque_token(payload.refresh_token),
            AuthToken.purpose == "refresh",
            AuthToken.revoked_at.is_(None),
        )
    )
    if not token or aware(token.expires_at) <= utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = load_user(db, token.user_id)
    if not user or not user.is_active:
        token.revoked_at = utcnow()
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    token.revoked_at = utcnow()
    response = issue_token_pair(db, user)
    record_audit(db, action="auth.refresh", user=user, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> None:
    if not payload.refresh_token:
        return
    token = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_opaque_token(payload.refresh_token),
            AuthToken.purpose == "refresh",
            AuthToken.revoked_at.is_(None),
        )
    )
    if not token:
        return
    token.revoked_at = utcnow()
    user = load_user(db, token.user_id)
    if user:
        record_audit(
            db,
            action="auth.logout",
            user=user,
            entity_type="user",
            entity_id=user.id,
            request=request,
        )
    db.commit()


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="New password must be different")
    current_user.password_hash = hash_password(payload.new_password)
    revoke_user_tokens(db, current_user.id)
    record_audit(
        db,
        action="auth.password_changed",
        user=current_user,
        entity_type="user",
        entity_id=current_user.id,
        request=request,
    )
    db.commit()


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    generic = "If an account exists for this email, password reset instructions have been created."
    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    if not user:
        return ForgotPasswordResponse(message=generic)

    revoke_user_tokens(db, user.id, "password_reset")
    raw_token = generate_opaque_token()
    db.add(
        AuthToken(
            user_id=user.id,
            purpose="password_reset",
            token_hash=hash_opaque_token(raw_token),
            expires_at=utcnow() + timedelta(minutes=settings.password_reset_minutes),
        )
    )
    reset_url = f"{settings.frontend_url}/reset-password?token={raw_token}"
    sent = send_password_reset_email(recipient=user.email, reset_url=reset_url)
    record_audit(
        db,
        action="auth.password_reset_requested",
        user=user,
        entity_type="user",
        entity_id=user.id,
        details={"email_sent": sent},
        request=request,
    )
    db.commit()

    return ForgotPasswordResponse(
        message=generic,
        reset_token=raw_token if settings.is_development and not sent else None,
        reset_url=reset_url if settings.is_development and not sent else None,
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)) -> None:
    token = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_opaque_token(payload.token),
            AuthToken.purpose == "password_reset",
            AuthToken.revoked_at.is_(None),
        )
    )
    if not token or aware(token.expires_at) <= utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = load_user(db, token.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid reset request")

    user.password_hash = hash_password(payload.new_password)
    token.revoked_at = utcnow()
    revoke_user_tokens(db, user.id, "refresh")
    record_audit(
        db,
        action="auth.password_reset_completed",
        user=user,
        entity_type="user",
        entity_id=user.id,
        request=request,
    )
    db.commit()
