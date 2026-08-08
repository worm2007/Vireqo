from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Appointment, Business, Lead, User, utcnow
from .security import hash_password

DEMO_BUSINESS_SLUG = "vireqo-demo"
DEMO_EMAIL = "demo@vireqo.app"
LEGACY_DEMO_EMAIL = "demo@vireqo.local"
DEMO_PASSWORD = "VireqoDemo123!"


def _repair_or_create_demo_user(db: Session, business: Business) -> None:
    """Keep local demo login stable across older SQLite databases.

    Early local databases used demo@vireqo.local. The current auth endpoint
    expects demo@vireqo.app because `.local` can fail stricter email
    validators. This helper upgrades old dev DBs without requiring a manual
    sqlite command, and it is only reached when demo seeding is enabled.
    """
    demo_user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    legacy_user = db.scalar(select(User).where(User.email == LEGACY_DEMO_EMAIL))

    if demo_user:
        demo_user.business_id = business.id
        demo_user.name = demo_user.name or "Demo Founder"
        demo_user.role = demo_user.role or "owner"
        demo_user.is_active = True
        if not demo_user.email_verified_at:
            demo_user.email_verified_at = utcnow()
        db.commit()
        return

    if legacy_user:
        legacy_user.email = DEMO_EMAIL
        legacy_user.business_id = business.id
        legacy_user.name = legacy_user.name or "Demo Founder"
        legacy_user.role = legacy_user.role or "owner"
        legacy_user.is_active = True
        legacy_user.email_verified_at = legacy_user.email_verified_at or utcnow()
        db.commit()
        return

    db.add(
        User(
            business_id=business.id,
            name="Demo Founder",
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            email_verified_at=utcnow(),
        )
    )
    db.commit()


def seed_demo_data(db: Session) -> None:
    existing = db.scalar(select(Business).where(Business.slug == DEMO_BUSINESS_SLUG))
    if existing:
        _repair_or_create_demo_user(db, existing)
        return

    business = Business(
        name="Vireqo Demo Studio",
        slug=DEMO_BUSINESS_SLUG,
        industry="AI Growth Systems",
        description="Vireqo captures, qualifies and routes high-intent enquiries for modern service businesses.",
        website="https://vireqo.example",
        greeting="Welcome to Vireqo. What kind of growth bottleneck would you like to solve?",
    )
    db.add(business)
    db.flush()

    db.add(
        User(
            business_id=business.id,
            name="Demo Founder",
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            email_verified_at=utcnow(),
        )
    )

    samples = [
        ("Maya Kapoor", "maya@northstar.in", "+91 98765 10021", "Northstar Realty", "Need an AI lead system for two property websites. Ready to book a demo this week.", "₹40k–₹70k", "This week", 92, "hot", "qualified"),
        ("Arjun Mehta", "arjun@lumenclinic.com", "+91 98765 22018", "Lumen Skin Clinic", "We lose enquiries after clinic hours and need automated follow-up.", "₹20k–₹35k", "This month", 78, "hot", "contacted"),
        ("Sara Lewis", "sara@brightforge.co", "", "BrightForge", "Exploring a branded website chatbot for our agency clients.", "", "Next quarter", 61, "warm", "new"),
        ("Rohan Singh", "", "+91 98111 00448", "Elevate Fitness", "Interested in lead capture for trial memberships.", "₹10k–₹15k", "Next month", 55, "warm", "new"),
        ("Nina Patel", "nina@example.com", "", "Independent Consultant", "Looking for pricing information.", "", "", 38, "cold", "new"),
    ]
    for name, email, phone, company, need, budget, timeline, score, temperature, status in samples:
        db.add(
            Lead(
                business_id=business.id,
                name=name,
                email=email,
                phone=phone,
                company=company,
                need=need,
                budget=budget,
                timeline=timeline,
                score=score,
                temperature=temperature,
                status=status,
                source="Website chatbot",
            )
        )

    db.add(
        Appointment(
            business_id=business.id,
            name="Maya Kapoor",
            email="maya@northstar.in",
            starts_at=utcnow(),
            note="Vireqo product demo",
        )
    )
    db.commit()
