import type {
  AuditLog,
  Analytics,
  Appointment,
  AuthSession,
  Business,
  ChatHistory,
  ChatResponse,
  Conversation,
  ExecutiveInsights,
  ForgotPasswordResult,
  Lead,
  LeadDetail,
  LeadIntelligence,
  PipelineAutomation,
  RevenueForecast,
  TeamMember,
  User,
  WorkspaceDraftRequest,
  WorkspaceDraftResponse,
  WeeklyReport,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const ACCESS_KEY = "vireqo_access_token";
const REFRESH_KEY = "vireqo_refresh_token";
const USER_KEY = "vireqo_user";

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function persistSession(session: AuthSession): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(ACCESS_KEY, session.access_token);
  storage.setItem(REFRESH_KEY, session.refresh_token);
  storage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.removeItem(ACCESS_KEY);
  storage.removeItem(REFRESH_KEY);
  storage.removeItem(USER_KEY);
  // Remove the legacy token used by the earlier MVP.
  storage.removeItem("vireqo_token");
}

export function getStoredUser(): User | null {
  const raw = browserStorage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function hasSession(): boolean {
  const storage = browserStorage();
  return Boolean(storage?.getItem(ACCESS_KEY) || storage?.getItem(REFRESH_KEY));
}

function errorMessage(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg).replace(/^Value error, /, "");
          }
          return String(item);
        })
        .join(". ");
    }
  }
  return "Something went wrong";
}

async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Keep the fallback message for non-JSON responses.
    }
    const error = new Error(errorMessage(body)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = browserStorage()?.getItem(REFRESH_KEY);
    if (!refreshToken) {
      clearSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    try {
      const session = await rawRequest<AuthSession>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      persistSession(session);
      return session.access_token;
    } catch (error) {
      clearSession();
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  let accessToken = browserStorage()?.getItem(ACCESS_KEY);
  if (!accessToken) accessToken = await refreshAccessToken();

  try {
    return await rawRequest<T>(path, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401 && allowRefresh) {
      const refreshed = await refreshAccessToken();
      return authenticatedRequest<T>(
        path,
        {
          ...options,
          headers: {
            ...(options.headers ?? {}),
            Authorization: `Bearer ${refreshed}`,
          },
        },
        false,
      );
    }
    throw error;
  }
}

export async function demoLogin(): Promise<User> {
  const session = await rawRequest<AuthSession>("/auth/demo", { method: "POST" });
  persistSession(session);
  return session.user;
}

export async function login(email: string, password: string): Promise<User> {
  const session = await rawRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  persistSession(session);
  return session.user;
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  business_name: string;
  industry: string;
}): Promise<User> {
  const session = await rawRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  persistSession(session);
  return session.user;
}

export async function logout(): Promise<void> {
  const refreshToken = browserStorage()?.getItem(REFRESH_KEY) ?? null;
  try {
    if (refreshToken) {
      await rawRequest<void>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
  } finally {
    clearSession();
  }
}

export async function getCurrentUser(): Promise<User> {
  const user = await authenticatedRequest<User>("/auth/me");
  browserStorage()?.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authenticatedRequest<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  clearSession();
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  return rawRequest<ForgotPasswordResult>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await rawRequest<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  clearSession();
}

export async function getBusiness(): Promise<Business> {
  return authenticatedRequest<Business>("/businesses/me");
}

export async function updateBusiness(payload: Partial<Business>): Promise<Business> {
  return authenticatedRequest<Business>("/businesses/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAnalytics(): Promise<Analytics> {
  return authenticatedRequest<Analytics>("/analytics/summary");
}

export async function getExecutiveInsights(): Promise<ExecutiveInsights> {
  return authenticatedRequest<ExecutiveInsights>("/analytics/insights");
}

export async function getLeadIntelligence(): Promise<LeadIntelligence> {
  return authenticatedRequest<LeadIntelligence>("/analytics/lead-intelligence");
}

export async function getRevenueForecast(): Promise<RevenueForecast> {
  return authenticatedRequest<RevenueForecast>("/analytics/revenue-forecast");
}

export async function getWeeklyReport(): Promise<WeeklyReport> {
  return authenticatedRequest<WeeklyReport>("/analytics/weekly-report");
}

export async function getPipelineAutomation(): Promise<PipelineAutomation> {
  return authenticatedRequest<PipelineAutomation>("/analytics/pipeline-automation");
}

export async function getLeads(params: {
  status?: string;
  temperature?: string;
  search?: string;
  limit?: number;
} = {}): Promise<Lead[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.temperature) query.set("temperature", params.temperature);
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.size ? `?${query.toString()}` : "";
  return authenticatedRequest<Lead[]>(`/leads${suffix}`);
}

export async function createLead(payload: Partial<Lead>): Promise<Lead> {
  return authenticatedRequest<Lead>("/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export async function getLeadDetail(id: string): Promise<LeadDetail> {
  return authenticatedRequest<LeadDetail>(`/leads/${encodeURIComponent(id)}/activity`);
}

export async function updateLead(id: string, payload: Partial<Lead>): Promise<Lead> {
  return authenticatedRequest<Lead>(`/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<Lead> {
  return updateLead(id, { status });
}

export async function deleteLead(id: string): Promise<void> {
  return authenticatedRequest<void>(`/leads/${id}`, { method: "DELETE" });
}

export async function getAppointments(): Promise<Appointment[]> {
  return authenticatedRequest<Appointment[]>("/appointments");
}

export async function createAppointment(payload: {
  business_slug: string;
  lead_id?: string | null;
  name: string;
  email?: string;
  phone?: string;
  starts_at: string;
  note?: string;
}): Promise<Appointment> {
  return rawRequest<Appointment>("/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAppointment(
  id: string,
  payload: Partial<Appointment>,
): Promise<Appointment> {
  return authenticatedRequest<Appointment>(`/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAppointment(id: string): Promise<void> {
  return authenticatedRequest<void>(`/appointments/${id}`, { method: "DELETE" });
}

export async function getConversations(): Promise<Conversation[]> {
  return authenticatedRequest<Conversation[]>("/conversations");
}

export async function deleteConversation(id: string): Promise<void> {
  return authenticatedRequest<void>(`/conversations/${id}`, { method: "DELETE" });
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  return authenticatedRequest<AuditLog[]>(`/audit?limit=${Math.max(1, Math.min(limit, 500))}`);
}

export async function getTeam(): Promise<TeamMember[]> {
  return authenticatedRequest<TeamMember[]>("/team");
}

export async function createTeamMember(payload: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "member";
}): Promise<TeamMember> {
  return authenticatedRequest<TeamMember>("/team", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTeamMember(
  id: string,
  payload: Partial<Pick<TeamMember, "name" | "role" | "is_active">>,
): Promise<TeamMember> {
  return authenticatedRequest<TeamMember>(`/team/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function captureLead(payload: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  need: string;
  budget?: string;
  timeline?: string;
}): Promise<Lead> {
  return rawRequest<Lead>("/leads/capture/vireqo-demo", {
    method: "POST",
    body: JSON.stringify({ ...payload, source: "Vireqo website" }),
  });
}

export async function sendChat(
  payload: {
    session_id: string;
    message: string;
    name?: string;
    email?: string;
    phone?: string;
  },
  businessSlug = "vireqo-demo",
): Promise<ChatResponse> {
  return rawRequest<ChatResponse>(`/chat/${encodeURIComponent(businessSlug)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendWorkspaceChat(payload: {
  session_id: string;
  message: string;
}): Promise<ChatResponse> {
  return authenticatedRequest<ChatResponse>("/chat/workspace/assistant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateWorkspaceDraft(
  payload: WorkspaceDraftRequest,
): Promise<WorkspaceDraftResponse> {
  return authenticatedRequest<WorkspaceDraftResponse>("/chat/workspace/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWorkspaceChatHistory(sessionId: string): Promise<ChatHistory> {
  return authenticatedRequest<ChatHistory>(
    `/chat/workspace/history/${encodeURIComponent(sessionId)}`,
  );
}

export function getAccessToken(): string | null {
  return browserStorage()?.getItem(ACCESS_KEY) ?? null;
}

export function getRealtimeUrl(): string {
  const url = new URL(API_URL);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}${url.pathname}/realtime/ws`;
}
