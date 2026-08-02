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

export type ChatResponse = {
  session_id: string;
  reply: string;
  lead_created: boolean;
  lead_id?: string | null;
  score?: number | null;
  temperature?: string | null;
};

export type ForgotPasswordResult = {
  message: string;
  reset_token?: string | null;
  reset_url?: string | null;
};
