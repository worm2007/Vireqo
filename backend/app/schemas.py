from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BusinessPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    industry: str
    description: str
    website: str
    brand_color: str
    greeting: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str
    business: BusinessPublic


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    business_name: str = Field(min_length=2, max_length=160)
    industry: str = Field(default="Professional Services", max_length=100)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class LeadCreate(BaseModel):
    name: str = Field(default="Website visitor", max_length=120)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=60)
    company: str = Field(default="", max_length=160)
    need: str = Field(default="", max_length=2000)
    budget: str = Field(default="", max_length=120)
    timeline: str = Field(default="", max_length=120)
    source: str = Field(default="Website chatbot", max_length=80)


class LeadUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(new|contacted|qualified|won|lost)$")
    notes: str | None = Field(default=None, max_length=5000)
    score: int | None = Field(default=None, ge=0, le=100)


class LeadPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    phone: str
    company: str
    need: str
    budget: str
    timeline: str
    source: str
    status: str
    score: int
    temperature: str
    notes: str
    created_at: datetime
    updated_at: datetime


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=6, max_length=120)
    message: str = Field(min_length=1, max_length=4000)
    name: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=60)


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    lead_created: bool
    lead_id: str | None = None
    score: int | None = None
    temperature: str | None = None


class AppointmentCreate(BaseModel):
    business_slug: str
    lead_id: str | None = None
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=60)
    starts_at: datetime
    note: str = Field(default="", max_length=2000)


class AppointmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    phone: str
    starts_at: datetime
    status: str
    note: str
    created_at: datetime


class AnalyticsSummary(BaseModel):
    total_leads: int
    new_leads: int
    qualified_leads: int
    won_leads: int
    appointments: int
    conversion_rate: float
    average_score: float
    temperatures: dict[str, int]
    recent_leads: list[LeadPublic]
