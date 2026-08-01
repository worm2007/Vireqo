import type { Analytics, ChatResponse, Lead } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Something went wrong";
    try {
      const body = (await response.json()) as { detail?: string };
      message = body.detail ?? message;
    } catch {
      // Keep the fallback message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function demoLogin(): Promise<string> {
  const result = await request<{ access_token: string }>("/auth/demo", { method: "POST" });
  window.localStorage.setItem("vireqo_token", result.access_token);
  return result.access_token;
}

export async function login(email: string, password: string): Promise<string> {
  const result = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  window.localStorage.setItem("vireqo_token", result.access_token);
  return result.access_token;
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  business_name: string;
  industry: string;
}): Promise<string> {
  const result = await request<{ access_token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  window.localStorage.setItem("vireqo_token", result.access_token);
  return result.access_token;
}

export async function getToken(): Promise<string> {
  const existing = window.localStorage.getItem("vireqo_token");
  return existing || demoLogin();
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function getAnalytics(token: string): Promise<Analytics> {
  return request<Analytics>("/analytics/summary", { headers: authHeaders(token) });
}

export async function getLeads(token: string): Promise<Lead[]> {
  return request<Lead[]>("/leads", { headers: authHeaders(token) });
}

export async function updateLeadStatus(token: string, id: string, status: Lead["status"]): Promise<Lead> {
  return request<Lead>(`/leads/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
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
  return request<Lead>("/leads/capture/vireqo-demo", {
    method: "POST",
    body: JSON.stringify({ ...payload, source: "Vireqo website" }),
  });
}

export async function sendChat(payload: {
  session_id: string;
  message: string;
  name?: string;
  email?: string;
  phone?: string;
}): Promise<ChatResponse> {
  return request<ChatResponse>("/chat/vireqo-demo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
