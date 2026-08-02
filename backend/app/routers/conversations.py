from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Conversation, User
from ..schemas import ConversationPublic
from ..security import get_current_user
from ..services.audit import record_audit

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", response_model=list[ConversationPublic])
def list_conversations(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Conversation]:
    return list(
        db.scalars(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.business_id == current_user.business_id)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
        ).all()
    )


@router.get("/{conversation_id}", response_model=ConversationPublic)
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.business_id == current_user.business_id,
        )
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.business_id == current_user.business_id,
        )
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    record_audit(
        db,
        action="conversation.deleted",
        user=current_user,
        entity_type="conversation",
        entity_id=conversation.id,
        request=request,
    )
    db.delete(conversation)
    db.commit()
