from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Appointment, Business, Lead, User, utcnow
from .security import hash_password


def seed_demo_data(db: Session) -> None:
    existing = db.scalar(select(Business).where(Business.slug == "vireqo-demo"))
    if existing:
        return

    business = Business(
        name="Vireqo Demo Studio",
        slug="vireqo-demo",
        industry="AI Growth Systems",
        description="Vireqo captures, qualifies and routes high-intent enquiries for modern service businesses.",
        website="https://vireqo.example",
        greeting="Welcome to Vireqo. What kind of growth bottleneck would you like to solve?",
    )
    db.add(business)
    db.flush()

    user = User(
        business_id=business.id,
        name="Demo Founder",
        email="demo@vireqo.app",
        password_hash=hash_password("VireqoDemo123!"),
    )
    db.add(user)

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
