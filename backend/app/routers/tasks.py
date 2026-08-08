from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Lead, Task, User, utcnow
from ..schemas import TaskCreate, TaskPublic, TaskSummary, TaskUpdate
from ..security import get_current_user
from ..services.audit import record_audit
from ..services.realtime import workspace_events

router = APIRouter(prefix="/tasks", tags=["Tasks"])

VALID_STATUSES = {"open", "completed", "cancelled"}
VALID_PRIORITIES = {"urgent", "high", "medium", "low"}


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _today_bounds() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def _get_task(db: Session, business_id: str, task_id: str) -> Task:
    task = db.scalar(select(Task).where(Task.id == task_id, Task.business_id == business_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _validate_lead(db: Session, business_id: str, lead_id: str | None) -> None:
    if not lead_id:
        return
    lead = db.scalar(select(Lead.id).where(Lead.id == lead_id, Lead.business_id == business_id))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")


def _serialize(task: Task) -> TaskPublic:
    return TaskPublic.model_validate(task)


@router.get("", response_model=list[TaskPublic])
def list_tasks(
    status_filter: str | None = Query(default=None, alias="status"),
    lead_id: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    due_scope: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Task]:
    business_id = current_user.business_id
    query = select(Task).where(Task.business_id == business_id)

    if status_filter:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid task status")
        query = query.where(Task.status == status_filter)
    if lead_id:
        query = query.where(Task.lead_id == lead_id)
    if priority:
        if priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid task priority")
        query = query.where(Task.priority == priority)
    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(or_(func.lower(Task.title).like(term), func.lower(Task.description).like(term)))

    now = datetime.now(timezone.utc)
    start, end = _today_bounds()
    if due_scope == "overdue":
        query = query.where(Task.status == "open", Task.due_at.is_not(None), Task.due_at < now)
    elif due_scope == "today":
        query = query.where(Task.status == "open", Task.due_at >= start, Task.due_at < end)
    elif due_scope == "upcoming":
        query = query.where(Task.status == "open", Task.due_at >= end)
    elif due_scope:
        raise HTTPException(status_code=400, detail="Invalid due scope")

    return list(
        db.scalars(
            query.order_by(
                asc(Task.status),
                desc(Task.priority == "urgent"),
                desc(Task.priority == "high"),
                asc(Task.due_at.is_(None)),
                asc(Task.due_at),
                desc(Task.created_at),
            ).limit(limit)
        ).all()
    )


@router.get("/summary", response_model=TaskSummary)
def task_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskSummary:
    business_id = current_user.business_id
    now = datetime.now(timezone.utc)
    start, end = _today_bounds()

    total_open = db.scalar(select(func.count(Task.id)).where(Task.business_id == business_id, Task.status == "open")) or 0
    overdue = db.scalar(
        select(func.count(Task.id)).where(
            Task.business_id == business_id,
            Task.status == "open",
            Task.due_at.is_not(None),
            Task.due_at < now,
        )
    ) or 0
    due_today = db.scalar(
        select(func.count(Task.id)).where(
            Task.business_id == business_id,
            Task.status == "open",
            Task.due_at >= start,
            Task.due_at < end,
        )
    ) or 0
    high_priority = db.scalar(
        select(func.count(Task.id)).where(
            Task.business_id == business_id,
            Task.status == "open",
            Task.priority.in_(["urgent", "high"]),
        )
    ) or 0
    completed = db.scalar(select(func.count(Task.id)).where(Task.business_id == business_id, Task.status == "completed")) or 0

    if overdue:
        headline = f"{overdue} overdue task{'s' if overdue != 1 else ''} need attention."
    elif due_today:
        headline = f"{due_today} task{'s' if due_today != 1 else ''} due today."
    elif total_open:
        headline = "Your task queue is active and under control."
    else:
        headline = "No open tasks. Convert automation suggestions into reminders when needed."

    return TaskSummary(
        generated_at=datetime.now(timezone.utc),
        total_open=int(total_open),
        overdue=int(overdue),
        due_today=int(due_today),
        high_priority=int(high_priority),
        completed=int(completed),
        headline=headline,
    )


@router.post("", response_model=TaskPublic, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskPublic:
    _validate_lead(db, current_user.business_id, payload.lead_id)
    task = Task(
        business_id=current_user.business_id,
        lead_id=payload.lead_id,
        created_by_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        priority=payload.priority,
        status=payload.status,
        source=payload.source.strip() or "manual",
        due_at=_aware(payload.due_at),
    )
    if task.status == "completed":
        task.completed_at = utcnow()

    db.add(task)
    db.flush()
    record_audit(
        db,
        action="task.created",
        user=current_user,
        entity_type="task",
        entity_id=task.id,
        details={"title": task.title, "lead_id": task.lead_id, "source": task.source},
        request=request,
    )
    db.commit()
    db.refresh(task)
    workspace_events.publish(
        current_user.business_id,
        "task.created",
        {"id": task.id, "title": task.title, "lead_id": task.lead_id, "priority": task.priority},
    )
    return _serialize(task)


@router.patch("/{task_id}", response_model=TaskPublic)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskPublic:
    task = _get_task(db, current_user.business_id, task_id)
    changes = payload.model_dump(exclude_unset=True)
    if "lead_id" in changes:
        _validate_lead(db, current_user.business_id, payload.lead_id)

    for key, value in changes.items():
        if key == "due_at":
            setattr(task, key, _aware(value))
        elif isinstance(value, str):
            setattr(task, key, value.strip())
        else:
            setattr(task, key, value)

    if "status" in changes:
        if task.status == "completed" and task.completed_at is None:
            task.completed_at = utcnow()
        elif task.status != "completed":
            task.completed_at = None

    record_audit(
        db,
        action="task.updated",
        user=current_user,
        entity_type="task",
        entity_id=task.id,
        details={"fields": list(changes)},
        request=request,
    )
    db.commit()
    db.refresh(task)
    workspace_events.publish(
        current_user.business_id,
        "task.updated",
        {"id": task.id, "title": task.title, "status": task.status, "lead_id": task.lead_id},
    )
    return _serialize(task)


@router.patch("/{task_id}/complete", response_model=TaskPublic)
def complete_task(
    task_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskPublic:
    task = _get_task(db, current_user.business_id, task_id)
    task.status = "completed"
    task.completed_at = utcnow()
    record_audit(
        db,
        action="task.completed",
        user=current_user,
        entity_type="task",
        entity_id=task.id,
        details={"title": task.title, "lead_id": task.lead_id},
        request=request,
    )
    db.commit()
    db.refresh(task)
    workspace_events.publish(
        current_user.business_id,
        "task.completed",
        {"id": task.id, "title": task.title, "lead_id": task.lead_id},
    )
    return _serialize(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    task = _get_task(db, current_user.business_id, task_id)
    record_audit(
        db,
        action="task.deleted",
        user=current_user,
        entity_type="task",
        entity_id=task.id,
        details={"title": task.title, "lead_id": task.lead_id},
        request=request,
    )
    payload = {"id": task.id, "title": task.title, "lead_id": task.lead_id}
    db.delete(task)
    db.commit()
    workspace_events.publish(current_user.business_id, "task.deleted", payload)
