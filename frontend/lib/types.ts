export type Business = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  description: string;
  website: string;
  brand_color: string;
  greeting: string;
  created_at?: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  is_active: boolean;
  created_at: string;
  business: Business;
};

export type TeamMember = Omit<User, "business">;

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  need: string;
  budget: string;
  timeline: string;
  source: string;
  status: "new" | "contacted" | "qualified" | "won" | "lost";
  score: number;
  temperature: "hot" | "warm" | "cold";
  notes: string;
  created_at: string;
  updated_at: string;
};


export type LeadPrediction = {
  lead_id: string;
  score: number;
  temperature: "hot" | "warm" | "cold";
  conversion_probability: number;
  conversion_label: string;
  confidence: number;
  next_action: string;
  next_action_priority: "high" | "medium" | "normal" | string;
  reasons: string[];
  risks: string[];
  signals: Record<string, number>;
  score_breakdown: Record<string, number>;
  estimated_budget_value?: number | null;
};

export type LeadIntelligence = {
  generated_at: string;
  summary: {
    average_score: number;
    average_conversion_probability: number;
    high_intent_count: number;
    at_risk_count: number;
    best_opportunity_id?: string | null;
    recommended_focus: string;
  };
  predictions: LeadPrediction[];
};

export type RevenueForecastStage = {
  stage: string;
  count: number;
  pipeline_value: number;
  weighted_value: number;
  pipeline_value_label: string;
  weighted_value_label: string;
};

export type RevenueForecastBucket = {
  window: string;
  count: number;
  pipeline_value: number;
  weighted_value: number;
  pipeline_value_label: string;
  weighted_value_label: string;
};

export type RevenueForecastOpportunity = {
  lead_id: string;
  name: string;
  company: string;
  status: string;
  estimated_value: number;
  estimated_value_label: string;
  weighted_value: number;
  weighted_value_label: string;
  conversion_probability: number;
  expected_window: string;
  next_action: string;
};

export type AtRiskRevenueLead = {
  lead_id: string;
  name: string;
  company: string;
  status: string;
  estimated_value: number;
  estimated_value_label: string;
  conversion_probability: number;
  risk_level: "critical" | "high" | "medium" | string;
  reason: string;
  next_action: string;
};

export type RevenueForecast = {
  generated_at: string;
  currency: string;
  summary: {
    pipeline_value: number;
    pipeline_value_label: string;
    weighted_forecast: number;
    weighted_forecast_label: string;
    likely_this_month: number;
    likely_this_month_label: string;
    at_risk_value: number;
    at_risk_value_label: string;
    committed_value: number;
    committed_value_label: string;
    forecast_confidence: number;
    forecast_label: string;
    recommendation: string;
  };
  signals: {
    open_leads_count: number;
    with_budget_count: number;
    missing_budget_count: number;
    high_value_count: number;
    at_risk_count: number;
    hot_value: number;
    warm_value: number;
    cold_value: number;
  };
  stage_forecast: RevenueForecastStage[];
  monthly_buckets: RevenueForecastBucket[];
  forecast_opportunities: RevenueForecastOpportunity[];
  at_risk_leads: AtRiskRevenueLead[];
};

export type Appointment = {
  id: string;
  lead_id?: string | null;
  name: string;
  email: string;
  phone: string;
  starts_at: string;
  status: "booked" | "confirmed" | "completed" | "cancelled" | "no_show";
  note: string;
  created_at: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  session_id: string;
  lead_id?: string | null;
  summary: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

export type Analytics = {
  total_leads: number;
  new_leads: number;
  qualified_leads: number;
  won_leads: number;
  appointments: number;
  conversion_rate: number;
  average_score: number;
  temperatures: Record<string, number>;
  recent_leads: Lead[];
};


export type ExecutivePriority = {
  type: string;
  title: string;
  detail: string;
  href: string;
  urgency: "high" | "medium" | "normal" | string;
};

export type ExecutiveNotification = {
  kind: string;
  title: string;
  detail: string;
  href: string;
};

export type ExecutiveInsights = {
  generated_at: string;
  health: {
    score: number;
    label: string;
    components: {
      lead_quality: number;
      pipeline: number;
      follow_up: number;
      appointments: number;
      response_speed: number;
    };
  };
  executive_summary: string;
  recommended_action: {
    title: string;
    detail: string;
    href: string;
  };
  priorities: ExecutivePriority[];
  notifications: ExecutiveNotification[];
  metrics: {
    pipeline_health: number;
    lead_quality: number;
    follow_up_rate: number;
    response_speed: number;
    ai_confidence: number;
    pipeline_value?: string | null;
    weighted_forecast?: string | null;
    top_source: string;
    today_appointments: number;
    overdue_follow_ups: number;
  };
};

export type ChatResponse = {
  session_id: string;
  reply: string;
  lead_created: boolean;
  lead_id?: string | null;
  score?: number | null;
  temperature?: string | null;
  action_type?: string | null;
  action_label?: string | null;
  action_entity_id?: string | null;
  memory_label?: string | null;
};

export type ChatHistory = {
  session_id: string;
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  memory_label?: string | null;
};

export type ForgotPasswordResult = {
  message: string;
  reset_token?: string | null;
  reset_url?: string | null;
};
export type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  created_at: string;
};


export type WorkspaceDraftRequest = {
  draft_type: string;
  recipient?: string;
  context?: string;
  goal?: string;
  tone?: string;
};

export type WorkspaceDraftResponse = {
  draft: string;
  subject?: string | null;
  draft_type: string;
  suggestions: string[];
};

export type CommandHistoryEntry = {
  id: string;
  title: string;
  description: string;
  kind: "command" | "draft" | "voice" | "navigation";
  status: "completed" | "failed" | "started";
  createdAt: string;
  preview?: string;
};
