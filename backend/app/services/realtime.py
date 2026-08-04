from __future__ import annotations

import asyncio
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class Subscriber:
    id: str
    business_id: str
    queue: asyncio.Queue[dict[str, Any]]
    loop: asyncio.AbstractEventLoop


class WorkspaceEventManager:
    def __init__(self) -> None:
        self._subscribers: dict[str, dict[str, Subscriber]] = {}
        self._lock = threading.Lock()

    def subscribe(self, business_id: str) -> Subscriber:
        subscriber = Subscriber(
            id=uuid.uuid4().hex,
            business_id=business_id,
            queue=asyncio.Queue(maxsize=100),
            loop=asyncio.get_running_loop(),
        )
        with self._lock:
            self._subscribers.setdefault(business_id, {})[subscriber.id] = subscriber
        return subscriber

    def unsubscribe(self, subscriber: Subscriber) -> None:
        with self._lock:
            workspace = self._subscribers.get(subscriber.business_id)
            if not workspace:
                return
            workspace.pop(subscriber.id, None)
            if not workspace:
                self._subscribers.pop(subscriber.business_id, None)

    def publish(
        self,
        business_id: str,
        event_type: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        event = {
            "id": uuid.uuid4().hex,
            "type": event_type,
            "business_id": business_id,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload or {},
        }
        with self._lock:
            subscribers = list(self._subscribers.get(business_id, {}).values())

        for subscriber in subscribers:
            def offer(target: Subscriber = subscriber) -> None:
                if target.queue.full():
                    try:
                        target.queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                target.queue.put_nowait(event)

            try:
                subscriber.loop.call_soon_threadsafe(offer)
            except RuntimeError:
                self.unsubscribe(subscriber)


workspace_events = WorkspaceEventManager()
