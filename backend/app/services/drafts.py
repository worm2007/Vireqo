from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from ..config import settings
from ..models import Business
from .ai import clean_ai_text


@dataclass(frozen=True)
class DraftResult:
    draft: str
    subject: str | None
    draft_type: str
    suggestions: list[str]


DRAFT_LABELS: dict[str, str] = {
    "follow_up_email": "follow-up email",
    "whatsapp_follow_up": "WhatsApp follow-up",
    "proposal_intro": "proposal introduction",
    "meeting_confirmation": "meeting confirmation",
    "cold_outreach": "cold outreach message",
    "client_reply": "client reply",
}


def normalise_draft_type(value: str) -> str:
    clean = re.sub(r"[^a-z0-9_ -]", "", value.lower()).replace(" ", "_").replace("-", "_")
    return clean if clean in DRAFT_LABELS else "follow_up_email"


def first_name(value: str) -> str:
    name = value.strip().split(" ")[0] if value.strip() else "there"
    return name or "there"


def subject_for(draft_type: str, recipient: str, goal: str) -> str | None:
    if "email" not in draft_type and draft_type not in {"cold_outreach", "client_reply"}:
        return None

    clean_goal = goal.strip().rstrip(".")
    if clean_goal:
        return clean_goal[:72]
    if recipient.strip():
        return f"Next steps for {recipient.strip()}"
    return "Next steps"


def fallback_draft(
    *,
    draft_type: str,
    recipient: str,
    context: str,
    goal: str,
    tone: str,
) -> str:
    name = first_name(recipient)
    target = goal.strip() or "confirm the next step"
    context_line = context.strip() or "our recent conversation"

    if draft_type == "whatsapp_follow_up":
        return (
            f"Hi {name}, thanks for your time. Based on {context_line}, the best next step is to {target}. "
            "Should I share the details and a suitable time to continue?"
        )

    if draft_type == "meeting_confirmation":
        return (
            f"Hi {name}, confirming our meeting. We will focus on {context_line} and use the conversation to {target}. "
            "Please let me know if there is anything specific you would like me to prepare before the call."
        )

    if draft_type == "proposal_intro":
        return (
            f"Hi {name}, based on {context_line}, I have prepared a focused proposal around {target}. "
            "The plan is designed to keep the scope clear, make the next decision simple, and move toward a measurable business outcome."
        )

    if draft_type == "cold_outreach":
        return (
            f"Hi {name}, I noticed an opportunity to help with {target}. "
            "Vireqo can help your team capture leads, qualify intent, and follow up faster from one AI-powered workspace. "
            "Would it make sense to share a quick example?"
        )

    if draft_type == "client_reply":
        return (
            f"Hi {name}, thanks for the update. Based on {context_line}, I recommend we {target}. "
            "This keeps the next step clear and avoids unnecessary back-and-forth."
        )

    return (
        f"Hi {name}, thanks for your time. Based on {context_line}, I recommend we {target}. "
        "This should help us move forward with a clear next step. Please let me know what time works best for you."
    )


def follow_up_suggestions(draft_type: str) -> list[str]:
    if draft_type == "whatsapp_follow_up":
        return [
            "Send after adding the prospect's preferred time.",
            "Keep it under two short paragraphs for WhatsApp.",
            "Add one clear call-to-action before sending.",
        ]
    if draft_type == "meeting_confirmation":
        return [
            "Attach agenda points before sending.",
            "Confirm timezone when the client is outside your city.",
            "Add a calendar link once integrations are enabled.",
        ]
    return [
        "Personalise the first sentence before sending.",
        "Keep only one next step in the message.",
        "Add a specific time or date when the follow-up is urgent.",
    ]


async def generate_workspace_draft(
    *,
    business: Business,
    draft_type: str,
    recipient: str,
    context: str,
    goal: str,
    tone: str,
    workspace_context: str = "",
) -> DraftResult:
    clean_type = normalise_draft_type(draft_type)
    label = DRAFT_LABELS[clean_type]
    clean_tone = tone.strip() or "professional"

    if not settings.groq_api_key:
        return DraftResult(
            draft=fallback_draft(
                draft_type=clean_type,
                recipient=recipient,
                context=context,
                goal=goal,
                tone=clean_tone,
            ),
            subject=subject_for(clean_type, recipient, goal),
            draft_type=clean_type,
            suggestions=follow_up_suggestions(clean_type),
        )

    prompt = f"""
You are Vireqo Draft Studio, a private CRM writing assistant for {business.name}.

Business context
Industry: {business.industry or 'Not specified'}
Description: {business.description or 'No description provided.'}

Draft request
Type: {label}
Recipient or lead: {recipient or 'Not specified'}
Tone: {clean_tone}
Goal: {goal or 'Move the conversation to one clear next step.'}
Context: {context or 'No additional context provided.'}
Recent workspace context: {workspace_context or 'No relevant records supplied.'}

Rules
Write only the final draft body.
Do not use Markdown, bullets, hashtags, emojis, placeholders, or decorative symbols.
Do not claim integrations, pricing, discounts, dates, meetings, or facts that were not supplied.
Keep it concise, commercially useful, and ready to copy.
For WhatsApp, keep it conversational and under 80 words.
For email, include a greeting and sign off, but do not include a subject line.
""".strip()

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.groq_model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You write polished, plain-text CRM drafts. Return only the final draft body.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.35,
                    "max_tokens": 460,
                },
            )
            response.raise_for_status()
            draft = clean_ai_text(str(response.json()["choices"][0]["message"]["content"]))
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        draft = fallback_draft(
            draft_type=clean_type,
            recipient=recipient,
            context=context,
            goal=goal,
            tone=clean_tone,
        )

    return DraftResult(
        draft=draft,
        subject=subject_for(clean_type, recipient, goal),
        draft_type=clean_type,
        suggestions=follow_up_suggestions(clean_type),
    )
