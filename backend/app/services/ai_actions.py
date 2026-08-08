from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from ..models import Appointment, Lead, Task, User
from .audit import record_audit
from .lead_scoring import calculate_lead_score

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?\d[\d\s()-]{7,}\d)")
STATUS_RE = re.compile(r"\b(new|contacted|qualified|won|lost)\b", re.IGNORECASE)
MEMORY_REFERENCE_RE = re.compile(
    r"^(?:him|her|them|it|that\s+(?:lead|person|contact|opportunity)|the\s+same\s+(?:lead|person|contact)|same\s+(?:lead|person|contact)|the\s+lead|this\s+lead)$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class AiActionResult:
    handled: bool
    reply: str = ""
    action_type: str | None = None
    action_label: str | None = None
    entity_id: str | None = None
    memory_lead_id: str | None = None
    memory_label: str | None = None


def _clean_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" ,.-")
    return value[:120]


def _resolve_target(value: str, active_lead: Lead | None) -> str:
    cleaned = _clean_name(value)
    if active_lead and MEMORY_REFERENCE_RE.fullmatch(cleaned):
        return active_lead.email or active_lead.name
    return cleaned


def _find_lead(db: Session, business_id: str, query: str) -> Lead | None:
    query = query.strip().lower()
    if not query:
        return None
    email = EMAIL_RE.search(query)
    if email:
        return db.scalar(
            select(Lead).where(
                Lead.business_id == business_id,
                func.lower(Lead.email) == email.group(0).lower(),
            )
        )
    term = f"%{query}%"
    return db.scalar(
        select(Lead)
        .where(
            Lead.business_id == business_id,
            or_(func.lower(Lead.name).like(term), func.lower(Lead.company).like(term)),
        )
        .order_by(desc(Lead.updated_at))
    )


def _parse_lead_name(message: str) -> str:
    patterns = [
        r"(?:create|add)\s+(?:a\s+)?lead\s+(?:for\s+)?(.+?)(?=\s+(?:with|email|phone|company|from|who|that)\b|[,;]|$)",
        r"(?:create|add)\s+(?:a\s+)?(?:new\s+)?(?:contact|prospect)\s+(?:for\s+)?(.+?)(?=\s+(?:with|email|phone|company|from)\b|[,;]|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return _clean_name(match.group(1))
    return ""


def _extract_company(message: str) -> str:
    match = re.search(
        r"\b(?:company|from|at)\s+([A-Za-z0-9&.' -]{2,80})(?=\s+(?:email|phone|needs?|budget|timeline)\b|[,;]|$)",
        message,
        re.IGNORECASE,
    )
    return _clean_name(match.group(1)) if match else ""


def _extract_need(message: str) -> str:
    match = re.search(r"\b(?:needs?|requirement|looking for)\s*[:=-]?\s*(.+)$", message, re.IGNORECASE)
    return match.group(1).strip()[:4000] if match else "Created by Vireqo AI assistant"


def _parse_datetime(message: str) -> datetime | None:
    lowered = message.lower()
    now_local = datetime.now().astimezone()

    date_value = None
    if "tomorrow" in lowered:
        date_value = now_local.date() + timedelta(days=1)
    elif "today" in lowered:
        date_value = now_local.date()
    else:
        date_match = re.search(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", message)
        if date_match:
            date_value = datetime(
                int(date_match.group(1)),
                int(date_match.group(2)),
                int(date_match.group(3)),
            ).date()

    if date_value is None:
        return None

    time_match = re.search(r"\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", lowered)
    if not time_match:
        return None
    hour = int(time_match.group(1))
    minute = int(time_match.group(2) or 0)
    meridiem = time_match.group(3)
    if meridiem == "pm" and hour != 12:
        hour += 12
    if meridiem == "am" and hour == 12:
        hour = 0
    if hour > 23 or minute > 59:
        return None

    local_dt = datetime.combine(date_value, datetime.min.time(), tzinfo=now_local.tzinfo).replace(
        hour=hour, minute=minute
    )
    return local_dt.astimezone(timezone.utc)


def _lead_detail(lead: Lead) -> AiActionResult:
    return AiActionResult(
        handled=True,
        reply=(
            "Active opportunity\n\n"
            f"Name: {lead.name}\n"
            f"Company: {lead.company or 'Not provided'}\n"
            f"Email: {lead.email or 'Not provided'}\n"
            f"Status: {lead.status.title()}\n"
            f"Intent score: {lead.score}\n"
            f"Temperature: {lead.temperature.title()}\n"
            f"Need: {lead.need or 'Not recorded'}"
        ),
        action_type="lead.memory",
        action_label=f"Remembering {lead.name}",
        entity_id=lead.id,
        memory_lead_id=lead.id,
        memory_label=lead.name,
    )


def _pipeline_summary(db: Session, user: User) -> AiActionResult:
    business_id = user.business_id
    total = db.scalar(select(func.count(Lead.id)).where(Lead.business_id == business_id)) or 0
    qualified = db.scalar(
        select(func.count(Lead.id)).where(
            Lead.business_id == business_id,
            Lead.status.in_(["qualified", "won"]),
        )
    ) or 0
    won = db.scalar(
        select(func.count(Lead.id)).where(Lead.business_id == business_id, Lead.status == "won")
    ) or 0
    hot = db.scalar(
        select(func.count(Lead.id)).where(Lead.business_id == business_id, Lead.temperature == "hot")
    ) or 0
    upcoming = db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.business_id == business_id,
            Appointment.starts_at >= datetime.now(timezone.utc),
            Appointment.status.in_(["booked", "confirmed"]),
        )
    ) or 0
    conversion = round((won / total * 100) if total else 0, 1)
    return AiActionResult(
        handled=True,
        reply=(
            "Pipeline summary\n\n"
            f"Total opportunities: {total}\n"
            f"Hot leads: {hot}\n"
            f"Qualified or won: {qualified}\n"
            f"Won: {won}\n"
            f"Upcoming appointments: {upcoming}\n"
            f"Conversion rate: {conversion}%"
        ),
        action_type="pipeline.summary",
        action_label="Pipeline summary generated",
    )


def _list_leads(db: Session, user: User, message: str) -> AiActionResult:
    lowered = message.lower()
    condition = [Lead.business_id == user.business_id]
    label = "recent"
    for value in ("hot", "warm", "cold"):
        if value in lowered:
            condition.append(Lead.temperature == value)
            label = value
            break
    for value in ("new", "contacted", "qualified", "won", "lost"):
        if re.search(rf"\b{value}\b", lowered):
            condition.append(Lead.status == value)
            label = value
            break
    leads = list(db.scalars(select(Lead).where(*condition).order_by(desc(Lead.updated_at)).limit(8)).all())
    if not leads:
        return AiActionResult(True, f"No {label} opportunities were found in this workspace.", "lead.search", "Lead search completed")
    lines = [f"{label.title()} opportunities", ""]
    for index, lead in enumerate(leads, 1):
        contact = lead.company or lead.email or lead.phone or "No contact detail"
        lines.append(f"{index}. {lead.name} — {lead.status.title()}, intent {lead.score}, {contact}")
    remembered = leads[0] if len(leads) == 1 else None
    return AiActionResult(
        True,
        "\n".join(lines),
        "lead.search",
        f"Found {len(leads)} opportunities",
        remembered.id if remembered else None,
        remembered.id if remembered else None,
        remembered.name if remembered else None,
    )


def _create_lead(db: Session, user: User, message: str, request=None) -> AiActionResult:
    name = _parse_lead_name(message)
    email_match = EMAIL_RE.search(message)
    phone_match = PHONE_RE.search(message)
    if not name:
        return AiActionResult(True, "Please provide the lead's name. Example: Create a lead for Maya Singh, email maya@example.com, company Northstar Realty.")

    email = email_match.group(0).lower() if email_match else ""
    if email:
        existing = db.scalar(
            select(Lead).where(
                Lead.business_id == user.business_id,
                func.lower(Lead.email) == email,
            )
        )
        if existing:
            return AiActionResult(
                True,
                f"A lead with {email} already exists: {existing.name}. I did not create a duplicate.",
                "lead.duplicate",
                f"Remembering {existing.name}",
                existing.id,
                existing.id,
                existing.name,
            )

    company = _extract_company(message)
    phone = phone_match.group(0).strip() if phone_match else ""
    need = _extract_need(message)
    score = calculate_lead_score(need=need, email=email, phone=phone)
    lead = Lead(
        business_id=user.business_id,
        name=name,
        email=email,
        phone=phone,
        company=company,
        need=need,
        source="Vireqo AI assistant",
        score=score.score,
        temperature=score.temperature,
    )
    db.add(lead)
    db.flush()
    record_audit(
        db,
        action="ai.lead_created",
        user=user,
        entity_type="lead",
        entity_id=lead.id,
        details={"name": lead.name, "source": "workspace_assistant"},
        request=request,
    )
    db.commit()
    return AiActionResult(
        True,
        f"Lead created\n\nName: {lead.name}\nCompany: {lead.company or 'Not provided'}\nEmail: {lead.email or 'Not provided'}\nIntent score: {lead.score}\nTemperature: {lead.temperature.title()}",
        "lead.created",
        f"Created lead: {lead.name}",
        lead.id,
        lead.id,
        lead.name,
    )


def _update_status(db: Session, user: User, message: str, active_lead: Lead | None, request=None) -> AiActionResult:
    status_match = STATUS_RE.search(message)
    if not status_match:
        return AiActionResult(False)
    status = status_match.group(1).lower()
    target_match = re.search(
        r"(?:mark|move|update|change)\s+(.+?)\s+(?:as|to)\s+(?:new|contacted|qualified|won|lost)\b",
        message,
        re.IGNORECASE,
    )
    if not target_match:
        return AiActionResult(False)
    target = _clean_name(target_match.group(1))
    target = re.sub(r"^(?:the\s+)?lead\s+", "", target, flags=re.IGNORECASE)
    target = _resolve_target(target, active_lead)
    lead = _find_lead(db, user.business_id, target)
    if not lead:
        if MEMORY_REFERENCE_RE.fullmatch(_clean_name(target_match.group(1))) and not active_lead:
            return AiActionResult(True, "I do not have an active lead in memory yet. Mention the lead's name or email first.")
        return AiActionResult(True, f"I could not find a lead matching '{target}'. No changes were made.")
    old_status = lead.status
    lead.status = status
    record_audit(
        db,
        action="ai.lead_status_updated",
        user=user,
        entity_type="lead",
        entity_id=lead.id,
        details={"from": old_status, "to": status},
        request=request,
    )
    db.commit()
    return AiActionResult(
        True,
        f"Lead updated\n\n{lead.name} moved from {old_status.title()} to {status.title()}.",
        "lead.updated",
        f"Updated {lead.name} to {status.title()}",
        lead.id,
        lead.id,
        lead.name,
    )



def _parse_task_due(message: str) -> datetime | None:
    explicit = _parse_datetime(message)
    if explicit:
        return explicit

    lowered = message.lower()
    now_local = datetime.now().astimezone()
    if "tomorrow" in lowered:
        date_value = now_local.date() + timedelta(days=1)
    elif "today" in lowered:
        date_value = now_local.date()
    else:
        return None

    local_dt = datetime.combine(date_value, datetime.min.time(), tzinfo=now_local.tzinfo).replace(
        hour=17,
        minute=0,
    )
    return local_dt.astimezone(timezone.utc)


def _create_task(db: Session, user: User, message: str, active_lead: Lead | None, request=None) -> AiActionResult:
    lowered = message.lower()
    if not (
        re.search(r"\b(create|add|make)\b", lowered) and re.search(r"\b(task|reminder|todo|to-do)\b", lowered)
    ) and not re.search(r"\bremind me to\b", lowered):
        return AiActionResult(False)

    lead = None
    target_match = re.search(
        r"\b(?:for|with|about)\s+(.+?)(?=\s+(?:today|tomorrow|on|at|by)\b|[,;]|$)",
        message,
        re.IGNORECASE,
    )
    if target_match:
        target = _resolve_target(target_match.group(1), active_lead)
        lead = _find_lead(db, user.business_id, target)
    elif active_lead and re.search(r"\b(him|her|them|that lead|same person|this lead)\b", lowered):
        lead = active_lead

    task_title = re.sub(r"^\s*(?:create|add|make)\s+(?:a\s+)?(?:task|reminder|todo|to-do)\s*(?:to\s+)?", "", message, flags=re.IGNORECASE)
    task_title = re.sub(r"^\s*remind me to\s+", "", task_title, flags=re.IGNORECASE)
    task_title = re.sub(r"\b(?:today|tomorrow|on\s+20\d{2}-\d{1,2}-\d{1,2}|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b", "", task_title, flags=re.IGNORECASE)
    task_title = re.sub(r"\s+", " ", task_title).strip(" ,.-")

    if not task_title:
        return AiActionResult(True, "Please include the task. Example: Create a task to follow up with Rahul tomorrow.")

    priority = "medium"
    if re.search(r"\b(urgent|critical|asap)\b", lowered):
        priority = "urgent"
    elif re.search(r"\b(today|high priority|important)\b", lowered):
        priority = "high"
    elif re.search(r"\b(low priority|later)\b", lowered):
        priority = "low"

    due_at = _parse_task_due(message)
    task = Task(
        business_id=user.business_id,
        lead_id=lead.id if lead else None,
        created_by_id=user.id,
        title=task_title[:180],
        description=(f"Created by Vireqo AI assistant{f' for {lead.name}' if lead else ''}."),
        priority=priority,
        source="ai",
        due_at=due_at,
    )
    db.add(task)
    db.flush()
    record_audit(
        db,
        action="ai.task_created",
        user=user,
        entity_type="task",
        entity_id=task.id,
        details={"title": task.title, "lead_id": task.lead_id, "priority": task.priority},
        request=request,
    )
    db.commit()
    due_label = due_at.astimezone().strftime("%d %b, %I:%M %p") if due_at else "No due date"
    linked_label = f"\nLinked lead: {lead.name}" if lead else ""
    return AiActionResult(
        True,
        f"Task created\n\nTitle: {task.title}\nPriority: {task.priority.title()}\nDue: {due_label}{linked_label}",
        "task.created",
        f"Created task: {task.title}",
        task.id,
        lead.id if lead else (active_lead.id if active_lead else None),
        lead.name if lead else (active_lead.name if active_lead else None),
    )


def _schedule_appointment(db: Session, user: User, message: str, active_lead: Lead | None, request=None) -> AiActionResult:
    match = re.search(
        r"(?:schedule|book|create)\s+(?:a\s+)?(?:meeting|appointment|call)\s+(?:with|for)\s+(.+?)(?=\s+(?:today|tomorrow|on|at)\b|[,;]|$)",
        message,
        re.IGNORECASE,
    )
    target = ""
    if match:
        target = _resolve_target(match.group(1), active_lead)
    elif active_lead and re.search(r"\b(schedule|book|create)\b", message, re.IGNORECASE) and re.search(
        r"\b(meeting|appointment|call|him|her|them|that lead|same person)\b", message, re.IGNORECASE
    ):
        target = active_lead.email or active_lead.name
    else:
        return AiActionResult(False)

    lead = _find_lead(db, user.business_id, target)
    if not lead:
        if not active_lead and re.search(r"\b(him|her|them|that lead|same person)\b", message, re.IGNORECASE):
            return AiActionResult(True, "I do not have an active lead in memory yet. Mention the lead's name or email first.")
        return AiActionResult(True, f"I could not find a lead matching '{target}'. Create the lead first or use the exact lead name.")
    starts_at = _parse_datetime(message)
    if starts_at is None:
        return AiActionResult(
            True,
            f"I remember {lead.name}. Please include a date and time. Example: Schedule the meeting tomorrow at 3 PM.",
            memory_lead_id=lead.id,
            memory_label=lead.name,
        )
    if starts_at <= datetime.now(timezone.utc):
        return AiActionResult(True, "The appointment time must be in the future. No appointment was created.", memory_lead_id=lead.id, memory_label=lead.name)
    conflict = db.scalar(
        select(Appointment).where(
            Appointment.business_id == user.business_id,
            Appointment.starts_at == starts_at,
            Appointment.status.in_(["booked", "confirmed"]),
        )
    )
    if conflict:
        return AiActionResult(True, "That time slot is already booked. Choose another time.", memory_lead_id=lead.id, memory_label=lead.name)
    appointment = Appointment(
        business_id=user.business_id,
        lead_id=lead.id,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        starts_at=starts_at,
        note="Scheduled by Vireqo AI assistant",
    )
    db.add(appointment)
    if lead.status == "new":
        lead.status = "qualified"
    db.flush()
    record_audit(
        db,
        action="ai.appointment_created",
        user=user,
        entity_type="appointment",
        entity_id=appointment.id,
        details={"lead_id": lead.id, "starts_at": starts_at.isoformat()},
        request=request,
    )
    db.commit()
    local_time = starts_at.astimezone()
    return AiActionResult(
        True,
        f"Appointment created\n\nLead: {lead.name}\nDate: {local_time.strftime('%d %b %Y')}\nTime: {local_time.strftime('%I:%M %p')}\nStatus: Booked",
        "appointment.created",
        f"Booked meeting with {lead.name}",
        appointment.id,
        lead.id,
        lead.name,
    )


def try_workspace_action(
    *,
    db: Session,
    user: User,
    message: str,
    active_lead: Lead | None = None,
    request=None,
) -> AiActionResult:
    lowered = message.lower().strip()

    if active_lead and any(
        phrase in lowered
        for phrase in (
            "show that lead",
            "show the lead again",
            "show him again",
            "show her again",
            "who were we discussing",
            "who are we discussing",
            "the lead we discussed",
            "same lead",
        )
    ):
        return _lead_detail(active_lead)

    if any(term in lowered for term in ("pipeline summary", "summarize pipeline", "summarise pipeline", "workspace summary", "sales summary")):
        return _pipeline_summary(db, user)

    if re.search(r"\b(show|list|find|display)\b", lowered) and re.search(r"\b(leads?|opportunities|prospects?)\b", lowered):
        return _list_leads(db, user, message)

    task_result = _create_task(db, user, message, active_lead, request)
    if task_result.handled:
        return task_result

    if re.search(r"\b(create|add)\b", lowered) and re.search(r"\b(lead|contact|prospect)\b", lowered):
        return _create_lead(db, user, message, request)

    status_result = _update_status(db, user, message, active_lead, request)
    if status_result.handled:
        return status_result

    appointment_result = _schedule_appointment(db, user, message, active_lead, request)
    if appointment_result.handled:
        return appointment_result

    return AiActionResult(False, memory_lead_id=active_lead.id if active_lead else None, memory_label=active_lead.name if active_lead else None)
