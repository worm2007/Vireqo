from __future__ import annotations

import httpx

from ..config import settings
from ..models import Business, Message


async def generate_reply(*, business: Business, history: list[Message], user_message: str) -> str:
    if not settings.groq_api_key:
        return fallback_reply(user_message)

    messages = [
        {
            "role": "system",
            "content": (
                f"You are the concise, premium website concierge for {business.name}, a {business.industry} business. "
                f"Business description: {business.description}. Answer clearly, never invent facts, and guide the visitor "
                "toward sharing their goal, timeline, budget range, email, and phone number. Ask only one useful question at a time."
            ),
        }
    ]
    messages.extend({"role": item.role, "content": item.content} for item in history[-10:])
    messages.append({"role": "user", "content": user_message})

    try:
        async with httpx.AsyncClient(timeout=18.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": settings.groq_model,
                    "messages": messages,
                    "temperature": 0.35,
                    "max_tokens": 220,
                },
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
    except (httpx.HTTPError, KeyError, IndexError, TypeError):
        return fallback_reply(user_message)


def fallback_reply(message: str) -> str:
    lowered = message.lower()
    if any(word in lowered for word in ("price", "pricing", "cost", "budget")):
        return "I can help with the right plan. What outcome are you targeting, and what budget range should the team work within?"
    if any(word in lowered for word in ("book", "call", "meeting", "demo")):
        return "Perfect — we can arrange that. Share your email or phone number and your preferred timeline, and I’ll prepare the request."
    if "@" in message:
        return "Thank you — I’ve captured your contact. What would make this project a clear success for you?"
    if any(word in lowered for word in ("urgent", "today", "week")):
        return "Understood — speed matters here. Please share the best email or phone number so the team can prioritise your request."
    return "That sounds useful. Tell me a little more about what you need, your ideal timeline, and the best way for the team to contact you."
