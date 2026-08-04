from __future__ import annotations

import asyncio

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..config import settings
from ..database import SessionLocal
from ..models import User
from ..services.realtime import workspace_events

router = APIRouter(prefix="/realtime", tags=["Realtime"])


def authenticate_access_token(token: str) -> User | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id or payload.get("typ") != "access":
            return None
    except jwt.PyJWTError:
        return None

    with SessionLocal() as db:
        return db.scalar(
            select(User)
            .options(selectinload(User.business))
            .where(User.id == user_id, User.is_active.is_(True))
        )


@router.websocket("/ws")
async def workspace_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    subscriber = None

    try:
        auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if auth_message.get("type") != "authenticate":
            await websocket.close(code=4401, reason="Authentication required")
            return

        user = authenticate_access_token(str(auth_message.get("token") or ""))
        if not user:
            await websocket.close(code=4401, reason="Invalid or expired session")
            return

        subscriber = workspace_events.subscribe(user.business_id)
        await websocket.send_json(
            {
                "type": "realtime.connected",
                "payload": {
                    "user_id": user.id,
                    "business_id": user.business_id,
                },
            }
        )

        while True:
            try:
                event = await asyncio.wait_for(subscriber.queue.get(), timeout=25)
                await websocket.send_json(event)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "realtime.ping", "payload": {}})
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        if subscriber:
            workspace_events.unsubscribe(subscriber)
