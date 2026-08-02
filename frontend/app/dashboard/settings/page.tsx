"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { changePassword, getBusiness, updateBusiness } from "@/lib/api";
import type { Business } from "@/lib/types";
import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getBusiness().then(setBusiness).catch((err) => setError(err instanceof Error ? err.message : "Unable to load settings")).finally(() => setLoading(false));
  }, []);

  async function saveBusiness(event: FormEvent) {
    event.preventDefault();
    if (!business) return;
    setSaving(true); setError(""); setMessage("");
    try {
      setBusiness(await updateBusiness({ name: business.name, industry: business.industry, description: business.description, website: business.website, brand_color: business.brand_color, greeting: business.greeting }));
      setMessage("Workspace settings saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save workspace"); }
    finally { setSaving(false); }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if (passwords.next !== passwords.confirm) return setError("New passwords do not match");
    setSaving(true);
    try {
      await changePassword(passwords.current, passwords.next);
      window.location.href = "/login";
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update password"); setSaving(false); }
  }

  return <DashboardShell><div className="module-heading"><div><span className="dashboard-eyebrow"><i /> Configuration</span><h1>Workspace settings</h1><p>Control your business identity and secure account access.</p></div></div>{error && <div className="dashboard-alert">{error}</div>}{message && <div className="dashboard-success">{message}</div>}{loading || !business ? <div className="module-loading"><LoaderCircle className="spin" /> Loading settings</div> : <div className="settings-grid"><form className="dashboard-form-card" onSubmit={saveBusiness}><div className="settings-card-title"><Save size={18} /><div><h3>Business profile</h3><p>Used throughout the dashboard and AI concierge.</p></div></div><div className="dashboard-form-grid"><label><span>Business name</span><input required value={business.name} onChange={(event) => setBusiness({ ...business, name: event.target.value })} /></label><label><span>Industry</span><input required value={business.industry} onChange={(event) => setBusiness({ ...business, industry: event.target.value })} /></label><label><span>Website</span><input value={business.website} onChange={(event) => setBusiness({ ...business, website: event.target.value })} placeholder="https://example.com" /></label><label><span>Brand colour</span><input value={business.brand_color} onChange={(event) => setBusiness({ ...business, brand_color: event.target.value })} placeholder="#C7FF42" /></label></div><label><span>Description</span><textarea value={business.description} onChange={(event) => setBusiness({ ...business, description: event.target.value })} /></label><label><span>AI greeting</span><textarea value={business.greeting} onChange={(event) => setBusiness({ ...business, greeting: event.target.value })} /></label><button className="button button-dashboard" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save workspace</button></form><form className="dashboard-form-card" onSubmit={savePassword}><div className="settings-card-title"><ShieldCheck size={18} /><div><h3>Change password</h3><p>Changing it revokes every active session.</p></div></div><label><span>Current password</span><input required type="password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} /></label><label><span>New password</span><input required minLength={8} type="password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} placeholder="Include a letter and number" /></label><label><span>Confirm password</span><input required minLength={8} type="password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} /></label><button className="button button-dashboard" disabled={saving}><ShieldCheck size={16} /> Update password</button></form></div>}</DashboardShell>;
}
