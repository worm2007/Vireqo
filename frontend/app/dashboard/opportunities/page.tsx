"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { createLead, deleteLead, getLeads, updateLeadStatus } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

const statusOptions: Lead["status"][] = ["new", "contacted", "qualified", "won", "lost"];

export default function OpportunitiesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [temperature, setTemperature] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", need: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      setLeads(await getLeads({ search, status, temperature, limit: 500 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load opportunities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, temperature]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const lead = await createLead({ ...form, source: "Dashboard" });
      setLeads((current) => [lead, ...current]);
      setForm({ name: "", email: "", phone: "", company: "", need: "" });
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create opportunity");
    }
  }

  async function changeStatus(lead: Lead, nextStatus: Lead["status"]) {
    const previous = lead.status;
    setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status: nextStatus } : item));
    try {
      await updateLeadStatus(lead.id, nextStatus);
    } catch {
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status: previous } : item));
      setError("Unable to update opportunity status");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this opportunity permanently?")) return;
    try {
      await deleteLead(id);
      setLeads((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete opportunity");
    }
  }

  return (
    <DashboardShell>
      <div className="module-heading"><div><span className="dashboard-eyebrow"><i /> CRM</span><h1>Opportunities</h1><p>Search, qualify and manage every captured lead.</p></div><button className="button button-dashboard" onClick={() => setShowCreate((value) => !value)}><Plus size={16} /> Add opportunity</button></div>
      {error && <div className="dashboard-alert">{error}</div>}
      {showCreate && <form className="dashboard-form-card" onSubmit={submit}><div className="dashboard-form-grid"><label><span>Name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label><span>Company</span><input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label></div><label><span>Need</span><textarea required value={form.need} onChange={(event) => setForm({ ...form, need: event.target.value })} /></label><button className="button button-dashboard" type="submit">Create opportunity</button></form>}
      <div className="module-toolbar"><label className="module-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company or need" /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select><select value={temperature} onChange={(event) => setTemperature(event.target.value)}><option value="">All intent levels</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></div>
      {loading ? <div className="module-loading"><LoaderCircle className="spin" /> Loading opportunities</div> : <div className="module-list">{leads.map((lead) => <article className="module-card opportunity-card" key={lead.id}><div className="module-card-main"><span className={`temperature ${lead.temperature}`}><i />{lead.temperature}</span><h3>{lead.name}</h3><p>{lead.company || lead.email || lead.phone || "No contact detail"}</p><small>{lead.need || "No qualification note yet"}</small></div><div className="opportunity-score"><strong>{lead.score}</strong><span>intent</span></div><select value={lead.status} onChange={(event) => void changeStatus(lead, event.target.value as Lead["status"])}>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select><button className="icon-button" onClick={() => void remove(lead.id)} aria-label="Delete opportunity"><Trash2 size={16} /></button></article>)}</div>}
      {!loading && leads.length === 0 && <div className="module-empty">No opportunities match these filters.</div>}
    </DashboardShell>
  );
}
