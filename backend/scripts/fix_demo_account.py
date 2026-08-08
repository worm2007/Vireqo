from __future__ import annotations

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Business, User, utcnow
from app.security import hash_password
from app.seed import DEMO_BUSINESS_SLUG, DEMO_EMAIL, DEMO_PASSWORD, LEGACY_DEMO_EMAIL


def main() -> None:
    with SessionLocal() as db:
        business = db.scalar(select(Business).where(Business.slug == DEMO_BUSINESS_SLUG))
        if not business:
            print("[fix-demo] No demo business found. Start the API once with SEED_DEMO_DATA=true/development.")
            return

        demo_user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        legacy_user = db.scalar(select(User).where(User.email == LEGACY_DEMO_EMAIL))

        if demo_user:
            demo_user.business_id = business.id
            demo_user.is_active = True
            demo_user.email_verified_at = demo_user.email_verified_at or utcnow()
            print(f"[fix-demo] Demo user already uses {DEMO_EMAIL}. Verified and activated it.")
        elif legacy_user:
            legacy_user.email = DEMO_EMAIL
            legacy_user.business_id = business.id
            legacy_user.is_active = True
            legacy_user.email_verified_at = legacy_user.email_verified_at or utcnow()
            print(f"[fix-demo] Updated legacy {LEGACY_DEMO_EMAIL} to {DEMO_EMAIL}.")
        else:
            db.add(
                User(
                    business_id=business.id,
                    name="Demo Founder",
                    email=DEMO_EMAIL,
                    password_hash=hash_password(DEMO_PASSWORD),
                    email_verified_at=utcnow(),
                )
            )
            print(f"[fix-demo] Created demo user {DEMO_EMAIL}.")

        db.commit()


if __name__ == "__main__":
    main()
