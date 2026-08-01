from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Business, Conversation, Lead, Message
from ..schemas import ChatRequest, ChatResponse
from ..services.ai import generate_reply
from ..services.lead_scoring import calculate_lead_score

router = APIRouter(prefix="/chat", tags=["Chatbot"])

EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s()-]{7,}\d)")


@router.post("/{business_slug}", response_model=ChatResponse)
async def chat(business_slug: str, payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    business = db.scalar(select(Business).where(Business.slug == business_slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages), selectinload(Conversation.lead))
        .where(Conversation.session_id == payload.session_id, Conversation.business_id == business.id)
    )
    if not conversation:
        conversation = Conversation(business_id=business.id, session_id=payload.session_id)
        db.add(conversation)
        db.flush()

    db.add(Message(conversation_id=conversation.id, role="user", content=payload.message.strip()))
    db.flush()

    history = list(conversation.messages)
    reply = await generate_reply(business=business, history=history, user_message=payload.message)
    db.add(Message(conversation_id=conversation.id, role="assistant", content=reply))

    detected_email = payload.email.strip() or (EMAIL_PATTERN.search(payload.message).group(0) if EMAIL_PATTERN.search(payload.message) else "")
    phone_match = PHONE_PATTERN.search(payload.message)
    detected_phone = payload.phone.strip() or (phone_match.group(0) if phone_match else "")
    lead_created = False
    lead = conversation.lead

    if not lead and (detected_email or detected_phone or payload.name.strip()):
        result = calculate_lead_score(
            need=payload.message,
            email=detected_email,
            phone=detected_phone,
        )
        lead = Lead(
            business_id=business.id,
            name=payload.name.strip() or "Website visitor",
            email=detected_email,
            phone=detected_phone,
            need=payload.message.strip(),
            score=result.score,
            temperature=result.temperature,
            source="Live AI concierge",
        )
        db.add(lead)
        db.flush()
        conversation.lead_id = lead.id
        lead_created = True
    elif lead:
        lead.need = f"{lead.need}\n{payload.message}".strip()
        if detected_email:
            lead.email = detected_email
        if detected_phone:
            lead.phone = detected_phone
        if payload.name.strip() and lead.name == "Website visitor":
            lead.name = payload.name.strip()
        result = calculate_lead_score(need=lead.need, email=lead.email, phone=lead.phone)
        lead.score = result.score
        lead.temperature = result.temperature

    db.commit()
    return ChatResponse(
        session_id=payload.session_id,
        reply=reply,
        lead_created=lead_created,
        lead_id=lead.id if lead else None,
        score=lead.score if lead else None,
        temperature=lead.temperature if lead else None,
    )
