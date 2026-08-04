from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Business, Conversation, Lead, Message, User
from ..schemas import ChatHistoryResponse, ChatRequest, ChatResponse
from ..security import get_current_user
from ..services.ai import generate_reply
from ..services.ai_actions import try_workspace_action
from ..services.lead_scoring import calculate_lead_score

router = APIRouter(prefix="/chat", tags=["Chatbot"])

EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s()-]{7,}\d)")


def get_or_create_conversation(
    *,
    db: Session,
    business_id: str,
    session_id: str,
) -> Conversation:
    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages), selectinload(Conversation.lead))
        .where(
            Conversation.session_id == session_id,
            Conversation.business_id == business_id,
        )
    )
    if conversation:
        return conversation

    conversation = Conversation(business_id=business_id, session_id=session_id)
    db.add(conversation)
    db.flush()
    return conversation


@router.post("/workspace/assistant", response_model=ChatResponse)
async def workspace_assistant(
    payload: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    business = current_user.business
    if business is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    conversation = get_or_create_conversation(
        db=db,
        business_id=business.id,
        session_id=payload.session_id,
    )

    history = list(conversation.messages)
    db.add(
        Message(
            conversation_id=conversation.id,
            role="user",
            content=payload.message.strip(),
        )
    )
    db.flush()

    action = try_workspace_action(
        db=db,
        user=current_user,
        message=payload.message,
        active_lead=conversation.lead,
        request=request,
    )
    if action.handled:
        reply = action.reply
    else:
        memory_context = ""
        if conversation.lead:
            memory_context = (
                f"Active lead: {conversation.lead.name}. "
                f"Company: {conversation.lead.company or 'Not provided'}. "
                f"Email: {conversation.lead.email or 'Not provided'}. "
                f"Status: {conversation.lead.status}. "
                "Resolve pronouns such as him, her, them, that lead, and the same person to this lead."
            )
        reply = await generate_reply(
            business=business,
            history=history,
            user_message=payload.message,
            mode="workspace",
            memory_context=memory_context,
        )

    if action.memory_lead_id:
        conversation.lead_id = action.memory_lead_id

    db.add(Message(conversation_id=conversation.id, role="assistant", content=reply))
    db.commit()

    return ChatResponse(
        session_id=payload.session_id,
        reply=reply,
        lead_created=action.action_type == "lead.created",
        lead_id=action.entity_id if action.action_type and action.action_type.startswith("lead.") else None,
        score=None,
        temperature=None,
        action_type=action.action_type,
        action_label=action.action_label,
        action_entity_id=action.entity_id,
        memory_label=action.memory_label or (conversation.lead.name if conversation.lead else None),
    )


@router.get("/workspace/history/{session_id}", response_model=ChatHistoryResponse)
def workspace_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatHistoryResponse:
    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages), selectinload(Conversation.lead))
        .where(
            Conversation.session_id == session_id,
            Conversation.business_id == current_user.business_id,
        )
    )
    if not conversation:
        return ChatHistoryResponse(session_id=session_id, messages=[], memory_label=None)
    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            {"role": item.role, "content": item.content}
            for item in conversation.messages[-40:]
            if item.role in {"user", "assistant"}
        ],
        memory_label=conversation.lead.name if conversation.lead else None,
    )


@router.post("/{business_slug}", response_model=ChatResponse)
async def chat(
    business_slug: str,
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    business = db.scalar(select(Business).where(Business.slug == business_slug))
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    conversation = get_or_create_conversation(
        db=db,
        business_id=business.id,
        session_id=payload.session_id,
    )

    history = list(conversation.messages)
    db.add(
        Message(
            conversation_id=conversation.id,
            role="user",
            content=payload.message.strip(),
        )
    )
    db.flush()

    reply = await generate_reply(
        business=business,
        history=history,
        user_message=payload.message,
        mode="concierge",
    )
    db.add(Message(conversation_id=conversation.id, role="assistant", content=reply))

    email_match = EMAIL_PATTERN.search(payload.message)
    detected_email = payload.email.strip() or (email_match.group(0) if email_match else "")
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
        result = calculate_lead_score(
            need=lead.need,
            email=lead.email,
            phone=lead.phone,
        )
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
