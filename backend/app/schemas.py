from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def clean_optional(value: str) -> str:
    return value.strip()


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
    created_at: datetime | None = None


class BusinessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    industry: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    website: str | None = Field(default=None, max_length=255)
    brand_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    greeting: str | None = Field(default=None, min_length=2, max_length=1000)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class UserPublic(UserSummary):
    business: BusinessPublic


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business_name: str = Field(min_length=2, max_length=160)
    industry: str = Field(default="Professional Services", min_length=2, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=30, max_length=300)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=30, max_length=300)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str | None = None
    reset_url: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=30, max_length=300)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic


class TeamMemberCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="member", pattern="^(admin|member)$")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class TeamMemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    role: str | None = Field(default=None, pattern="^(admin|member)$")
    is_active: bool | None = None


class LeadCreate(BaseModel):
    name: str = Field(default="Website visitor", max_length=120)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=60)
    company: str = Field(default="", max_length=160)
    need: str = Field(default="", max_length=4000)
    budget: str = Field(default="", max_length=120)
    timeline: str = Field(default="", max_length=120)
    source: str = Field(default="Website chatbot", max_length=80)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=60)
    company: str | None = Field(default=None, max_length=160)
    need: str | None = Field(default=None, max_length=4000)
    budget: str | None = Field(default=None, max_length=120)
    timeline: str | None = Field(default=None, max_length=120)
    source: str | None = Field(default=None, max_length=80)
    status: str | None = Field(default=None, pattern="^(new|contacted|qualified|won|lost)$")
    notes: str | None = Field(default=None, max_length=5000)
    score: int | None = Field(default=None, ge=0, le=100)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        return value.strip().lower() if value is not None else None


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




class LeadPrediction(BaseModel):
    lead_id: str
    score: int
    temperature: str
    conversion_probability: int
    conversion_label: str
    confidence: int
    next_action: str
    next_action_priority: str
    reasons: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    signals: dict[str, int] = Field(default_factory=dict)
    score_breakdown: dict[str, int] = Field(default_factory=dict)
    estimated_budget_value: int | None = None


class LeadIntelligenceSummary(BaseModel):
    average_score: float
    average_conversion_probability: float
    high_intent_count: int
    at_risk_count: int
    best_opportunity_id: str | None = None
    recommended_focus: str


class LeadIntelligenceResponse(BaseModel):
    generated_at: datetime
    summary: LeadIntelligenceSummary
    predictions: list[LeadPrediction]


class RevenueForecastSummary(BaseModel):
    pipeline_value: int
    pipeline_value_label: str
    weighted_forecast: int
    weighted_forecast_label: str
    likely_this_month: int
    likely_this_month_label: str
    at_risk_value: int
    at_risk_value_label: str
    committed_value: int
    committed_value_label: str
    forecast_confidence: int
    forecast_label: str
    recommendation: str


class RevenueForecastSignals(BaseModel):
    open_leads_count: int
    with_budget_count: int
    missing_budget_count: int
    high_value_count: int
    at_risk_count: int
    hot_value: int
    warm_value: int
    cold_value: int


class RevenueForecastStage(BaseModel):
    stage: str
    count: int
    pipeline_value: int
    weighted_value: int
    pipeline_value_label: str
    weighted_value_label: str


class RevenueForecastBucket(BaseModel):
    window: str
    count: int
    pipeline_value: int
    weighted_value: int
    pipeline_value_label: str
    weighted_value_label: str


class RevenueForecastOpportunity(BaseModel):
    lead_id: str
    name: str
    company: str
    status: str
    estimated_value: int
    estimated_value_label: str
    weighted_value: int
    weighted_value_label: str
    conversion_probability: int
    expected_window: str
    next_action: str


class AtRiskRevenueLead(BaseModel):
    lead_id: str
    name: str
    company: str
    status: str
    estimated_value: int
    estimated_value_label: str
    conversion_probability: int
    risk_level: str
    reason: str
    next_action: str


class RevenueForecastResponse(BaseModel):
    generated_at: datetime
    currency: str
    summary: RevenueForecastSummary
    signals: RevenueForecastSignals
    stage_forecast: list[RevenueForecastStage] = Field(default_factory=list)
    monthly_buckets: list[RevenueForecastBucket] = Field(default_factory=list)
    forecast_opportunities: list[RevenueForecastOpportunity] = Field(default_factory=list)
    at_risk_leads: list[AtRiskRevenueLead] = Field(default_factory=list)


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
    action_type: str | None = None
    action_label: str | None = None
    action_entity_id: str | None = None
    memory_label: str | None = None


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatHistoryMessage] = []
    memory_label: str | None = None


class WorkspaceDraftRequest(BaseModel):
    draft_type: str = Field(default="follow_up_email", max_length=80)
    recipient: str = Field(default="", max_length=160)
    context: str = Field(default="", max_length=4000)
    goal: str = Field(default="", max_length=1200)
    tone: str = Field(default="professional", max_length=80)

    @field_validator("draft_type", "recipient", "context", "goal", "tone")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class WorkspaceDraftResponse(BaseModel):
    draft: str
    subject: str | None = None
    draft_type: str
    suggestions: list[str] = []


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    created_at: datetime


class ConversationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    lead_id: str | None
    summary: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessagePublic] = []


class AppointmentCreate(BaseModel):
    business_slug: str
    lead_id: str | None = None
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=60)
    starts_at: datetime
    note: str = Field(default="", max_length=2000)


class AppointmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=60)
    starts_at: datetime | None = None
    status: str | None = Field(default=None, pattern="^(booked|confirmed|completed|cancelled|no_show)$")
    note: str | None = Field(default=None, max_length=2000)


class AppointmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lead_id: str | None
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


class AuditLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action: str
    entity_type: str
    entity_id: str
    details: str
    ip_address: str
    created_at: datetime
