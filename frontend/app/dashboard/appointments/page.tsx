"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { createAppointment, deleteAppointment, getAppointments, getCurrentUser, updateAppointment } from "@/lib/api";
import type { Appointment } from "@/lib/types";
import { CalendarDays, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

const statuses: Appointment["status"][] = ["booked", "confirmed", "completed", "cancelled", "no_show"];

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [businessSlug, setBusinessSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", starts_at: "", note: "" });

  useEffect(() => {
    Promise.all([getAppointments(), getCurrentUser()]).then(([appointments, user]) => { setItems(appointments); setBusinessSlug(user.business.slug); }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load appointments")).finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const appointment = await createAppointment({ ...form, business_slug: businessSlug, starts_at: new Date(form.starts_at).toISOString() });
      setItems((current) => [appointment, ...current]);
      setForm({ name: "", email: "", phone: "", starts_at: "", note: "" });
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book appointment");
    }
  }

  async function setStatus(item: Appointment, status: Appointment["status"]) {
    try {
      const updated = await updateAppointment(item.id, { status });
      setItems((current) => current.map((value) => value.id === item.id ? updated : value));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update appointment");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this appointment permanently?")) return;
    try { await deleteAppointment(id); setItems((current) => current.filter((item) => item.id !== id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to delete appointment"); }
  }

  return <DashboardShell><div className="module-heading"><div><span className="dashboard-eyebrow"><i /> Calendar</span><h1>Appointments</h1><p>Manage every booked call and update its outcome.</p></div><button className="button button-dashboard" onClick={() => setShowCreate((value) => !value)}><Plus size={16} /> Book appointment</button></div>{error && <div className="dashboard-alert">{error}</div>}{showCreate && <form className="dashboard-form-card" onSubmit={submit}><div className="dashboard-form-grid"><label><span>Name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label><span>Start time</span><input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label></div><label><span>Note</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label><button className="button button-dashboard">Book appointment</button></form>}{loading ? <div className="module-loading"><LoaderCircle className="spin" /> Loading appointments</div> : <div className="module-list">{items.map((item) => <article className="module-card appointment-card" key={item.id}><div className="conversation-icon"><CalendarDays size={18} /></div><div className="module-card-main"><h3>{item.name}</h3><p>{new Date(item.starts_at).toLocaleString()}</p><small>{item.email || item.phone || item.note || "No extra details"}</small></div><select value={item.status} onChange={(event) => void setStatus(item, event.target.value as Appointment["status"])}>{statuses.map((status) => <option key={status}>{status}</option>)}</select><button className="icon-button" onClick={() => void remove(item.id)}><Trash2 size={16} /></button></article>)}</div>}{!loading && items.length === 0 && <div className="module-empty">No appointments booked yet.</div>}</DashboardShell>;
}
