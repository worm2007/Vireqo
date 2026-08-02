from __future__ import annotations

import re
from typing import Literal

import httpx

from ..config import settings
from ..models import Business, Message

AiMode = Literal["concierge", "workspace"]


CONCIERGE_PROMPT = """
You are Vireqo Concierge, the premium website sales assistant for {business_name}.

Business context
Industry: {industry}
Description: {description}

Your job
Understand the visitor's requirement, identify buying intent, and guide the conversation toward a useful next step.

Response rules
Use polished plain text only.
Do not use Markdown, asterisks, hashtags, code blocks, emojis, or decorative symbols.
Do not begin with phrases such as Certainly, Absolutely, Of course, Here is, or I would be happy to help.
Keep the response concise and commercially useful.
Ask no more than one focused question at a time.
Never invent pricing, availability, guarantees, integrations, or company facts.
When enough context is available, recommend the clearest next step instead of repeating the visitor's message.
""".strip()


WORKSPACE_PROMPT = """
You are Vireqo Intelligence, the private revenue and CRM assistant for the signed-in team at {business_name}.

Business context
Industry: {industry}
Description: {description}

Your role
Act like a senior revenue operations consultant. Give practical advice for lead qualification, follow-up, conversion, appointments, pipeline management, and sales workflow.

Response rules
Use polished plain text only.
Do not use Markdown, asterisks, hashtags, code blocks, emojis, or decorative symbols.
Do not begin with phrases such as Certainly, Absolutely, Of course, Here is, or I would be happy to help.
Use short section labels only when they improve clarity, followed by clean sentences or numbered steps.
Be specific, decisive, and concise.
Do not ask for the user's email or phone number; this is an authenticated internal workspace.
Do not invent business data, lead records, appointments, performance figures, or integrations.
When information is missing, state the assumption briefly or ask one focused follow-up question.
""".strip()


def clean_ai_text(value: str) -> str:
    """Convert model output into clean product-ready plain text."""
    text = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    text = re.sub(r"```[a-zA-Z0-9_-]*", "", text)
    text = text.replace("```", "").replace("`", "")
    text = text.replace("**", "").replace("__", "").replace("*", "")
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
    text = re.sub(r"(?m)^\s*[-+>]\s+", "• ", text)
    text = re.sub(
        r"^(certainly|absolutely|of course|sure|here(?:'|’)s|here is|i(?:'|’)d be happy to help)[,!:;\s-]*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def generate_reply(
    *,
    business: Business,
    history: list[Message],
    user_message: str,
    mode: AiMode = "concierge",
) -> str:
    if not settings.groq_api_key:
        return fallback_reply(user_message, mode=mode)

    template = WORKSPACE_PROMPT if mode == "workspace" else CONCIERGE_PROMPT
    system_prompt = template.format(
        business_name=business.name or "the business",
        industry=business.industry or "Not specified",
        description=business.description or "No additional description is available.",
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(
        {"role": item.role, "content": item.content}
        for item in history[-12:]
        if item.role in {"user", "assistant"}
    )
    messages.append({"role": "user", "content": user_message})

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
                    "messages": messages,
                    "temperature": 0.25,
                    "max_tokens": 520 if mode == "workspace" else 280,
                },
            )
            response.raise_for_status()
            raw_reply = response.json()["choices"][0]["message"]["content"]
            cleaned = clean_ai_text(str(raw_reply))
            return cleaned or fallback_reply(user_message, mode=mode)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return fallback_reply(user_message, mode=mode)


def fallback_reply(message: str, *, mode: AiMode = "concierge") -> str:
    lowered = message.lower()

    if mode == "workspace":
        if any(word in lowered for word in ("follow up", "follow-up", "message", "email")):
            return (
                "Recommended follow-up\n\n"
                "Acknowledge the prospect's goal, restate the most relevant outcome, and give one clear next step. "
                "Keep the message under 100 words and include a specific time for the next conversation."
            )
        if any(word in lowered for word in ("qualify", "qualification", "lead")):
            return (
                "Qualification framework\n\n"
                "1. Confirm the business problem and desired outcome.\n"
                "2. Establish urgency and decision timeline.\n"
                "3. Identify budget range and decision authority.\n"
                "4. Confirm the next action before ending the conversation."
            )
        return (
            "Recommended approach\n\n"
            "Define the target outcome, identify the highest-intent opportunities, and assign one measurable next action to each lead. "
            "Share the industry, lead volume, and current bottleneck for a more specific plan."
        )

    if any(word in lowered for word in ("price", "pricing", "cost", "budget")):
        return "The right plan depends on the outcome and scope. What result are you targeting and what budget range should the team work within?"
    if any(word in lowered for word in ("book", "call", "meeting", "demo")):
        return "A product conversation is the best next step. Share your preferred timeline and the team can prepare the right session."
    if "@" in message:
        return "Your contact has been captured. What outcome would make this project successful?"
    if any(word in lowered for word in ("urgent", "today", "week")):
        return "The request appears time-sensitive. What is the latest acceptable completion date?"
    return "Please describe the result you need and the timeline you are working toward."
