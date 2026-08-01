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
