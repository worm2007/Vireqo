from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database import get_db
from ..models import AuthToken, Business, User, utcnow
from ..rate_limit import auth_endpoint_limiter, auth_failure_limiter, get_client_ip
from ..schemas import (
    ChangePasswordRequest,
    EmailVerificationResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
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
from ..services.email import EmailSendResult, send_email_verification_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

AUTH_ERROR = "Incorrect email or password"
RATE_LIMIT_ERROR = "Too many attempts. Please wait and try again."


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
        email_verification_required=settings.require_email_verification and not user.is_email_verified,
    )


def revoke_user_tokens(db: Session, user_id: str, purpose: str | None = None) -> None:
    conditions = [AuthToken.user_id == user_id, AuthToken.revoked_at.is_(None)]
    if purpose:
        conditions.append(AuthToken.purpose == purpose)
    db.execute(update(AuthToken).where(*conditions).values(revoked_at=utcnow()))


def create_email_verification_request(db: Session, user: User) -> tuple[str, str, EmailSendResult]:
    revoke_user_tokens(db, user.id, "email_verification")
    raw_token = generate_opaque_token()
    token_hash = hash_opaque_token(raw_token)
    db.add(
        AuthToken(
            user_id=user.id,
            purpose="email_verification",
            token_hash=token_hash,
            expires_at=utcnow() + timedelta(hours=settings.email_verification_hours),
        )
    )
    verification_url = f"{settings.frontend_url}/verify-email?token={raw_token}"
    result = send_email_verification_email(
        recipient=user.email,
        verification_url=verification_url,
        token_hash=token_hash,
    )
    return raw_token, verification_url, result


def _too_many_requests(retry_after_seconds: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail=RATE_LIMIT_ERROR,
        headers={"Retry-After": str(retry_after_seconds)},
    )


def _check_auth_endpoint_limit(request: Request, action: str, identifier: str = "") -> None:
    ip = get_client_ip(request)
    key = f"auth_endpoint:{action}:{ip}:{identifier}" if identifier else f"auth_endpoint:{action}:{ip}"
    result = auth_endpoint_limiter.check(key)
    if not result.allowed:
        raise _too_many_requests(result.retry_after_seconds)


def _login_failure_keys(request: Request, email: str) -> list[str]:
    ip = get_client_ip(request)
    normalized_email = email.strip().lower()
    return [f"login_ip:{ip}", f"login_email:{normalized_email}", f"login_combo:{ip}:{normalized_email}"]


def _enforce_login_failure_guard(request: Request, email: str) -> None:
    for key in _login_failure_keys(request, email):
        result = auth_failure_limiter.check(key, increment=False)
        if not result.allowed:
            raise _too_many_requests(result.retry_after_seconds)


def _record_login_failure(request: Request, email: str) -> None:
    for key in _login_failure_keys(request, email):
        auth_failure_limiter.check(key, increment=True)


def _clear_login_failures(request: Request, email: str) -> None:
    for key in _login_failure_keys(request, email):
        auth_failure_limiter.reset(key)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    _check_auth_endpoint_limit(request, "register")
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
    verification_token, verification_url, verification_result = create_email_verification_request(db, user)
    if settings.require_email_verification and settings.is_production and not verification_result.sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email verification is temporarily unavailable. Please try again in a few minutes.",
        )
    if settings.is_development and not verification_result.sent:
        response.email_verification_token = verification_token
        response.email_verification_url = verification_url
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
    _check_auth_endpoint_limit(request, "login", email)
    _enforce_login_failure_guard(request, email)

    user = db.scalar(select(User).options(selectinload(User.business)).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        _record_login_failure(request, email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=AUTH_ERROR)
    if not user.is_active:
        _record_login_failure(request, email)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is inactive")
    if settings.require_email_verification and not user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before signing in")

    _clear_login_failures(request, email)
    response = issue_token_pair(db, user)
    record_audit(db, action="auth.login", user=user, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return response


@router.post("/demo", response_model=TokenResponse)
def demo_login(request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    _check_auth_endpoint_limit(request, "demo")
    user = db.scalar(select(User).options(selectinload(User.business)).where(User.email == "demo@vireqo.app"))
    if not user:
        raise HTTPException(status_code=404, detail="Demo account is unavailable")
    response = issue_token_pair(db, user)
    record_audit(db, action="auth.demo_login", user=user, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return response


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    _check_auth_endpoint_limit(request, "refresh")
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
    email = str(payload.email).strip().lower()
    _check_auth_endpoint_limit(request, "forgot_password", email)
    generic = "If an account exists for this email, password reset instructions have been created."
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
    token_hash = hash_opaque_token(raw_token)
    reset_url = f"{settings.frontend_url}/reset-password?token={raw_token}"
    delivery = send_password_reset_email(recipient=user.email, reset_url=reset_url, token_hash=token_hash)
    record_audit(
        db,
        action="auth.password_reset_requested",
        user=user,
        entity_type="user",
        entity_id=user.id,
        details={"email_sent": delivery.sent, "email_provider": delivery.provider},
        request=request,
    )
    db.commit()

    return ForgotPasswordResponse(
        message=generic,
        reset_token=raw_token if settings.is_development and not delivery.sent else None,
        reset_url=reset_url if settings.is_development and not delivery.sent else None,
    )


@router.post("/resend-verification", response_model=EmailVerificationResponse)
def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> EmailVerificationResponse:
    email = str(payload.email).strip().lower()
    _check_auth_endpoint_limit(request, "resend_verification", email)
    generic = "If this email has an unverified Vireqo account, a verification link has been created."
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    if not user or user.is_email_verified:
        return EmailVerificationResponse(message=generic)

    verification_token, verification_url, verification_result = create_email_verification_request(db, user)
    record_audit(
        db,
        action="auth.email_verification_requested",
        user=user,
        entity_type="user",
        entity_id=user.id,
        details={"email_sent": verification_result.sent, "email_provider": verification_result.provider},
        request=request,
    )
    db.commit()
    return EmailVerificationResponse(
        message=generic,
        verification_token=verification_token if settings.is_development and not verification_result.sent else None,
        verification_url=verification_url if settings.is_development and not verification_result.sent else None,
        email_sent=verification_result.sent if settings.is_development else None,
    )


@router.post("/verify-email", response_model=EmailVerificationResponse)
def verify_email(payload: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)) -> EmailVerificationResponse:
    _check_auth_endpoint_limit(request, "verify_email")
    token = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_opaque_token(payload.token),
            AuthToken.purpose == "email_verification",
            AuthToken.revoked_at.is_(None),
        )
    )
    if not token or aware(token.expires_at) <= utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user = load_user(db, token.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid verification request")

    user.email_verified_at = user.email_verified_at or utcnow()
    token.revoked_at = utcnow()
    record_audit(
        db,
        action="auth.email_verified",
        user=user,
        entity_type="user",
        entity_id=user.id,
        request=request,
    )
    db.commit()
    return EmailVerificationResponse(message="Email verified. You can continue to Vireqo.")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)) -> None:
    _check_auth_endpoint_limit(request, "reset_password")
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
