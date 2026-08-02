"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { createTeamMember, getCurrentUser, getTeam, updateTeamMember } from "@/lib/api";
import type { TeamMember, User } from "@/lib/types";
import { LoaderCircle, Plus, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" as "admin" | "member" });

  useEffect(() => {
    Promise.all([getTeam(), getCurrentUser()]).then(([team, currentUser]) => { setMembers(team); setUser(currentUser); }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load team")).finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const member = await createTeamMember(form);
      setMembers((current) => [...current, member]);
      setForm({ name: "", email: "", password: "", role: "member" });
      setShowCreate(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create team member"); }
  }

  async function toggle(member: TeamMember) {
    try {
      const updated = await updateTeamMember(member.id, { is_active: !member.is_active });
      setMembers((current) => current.map((item) => item.id === member.id ? updated : item));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update team member"); }
  }

  async function changeRole(member: TeamMember, role: "admin" | "member") {
    try {
      const updated = await updateTeamMember(member.id, { role });
      setMembers((current) => current.map((item) => item.id === member.id ? updated : item));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update role"); }
  }

  const canManage = user?.role === "owner" || user?.role === "admin";
  return <DashboardShell><div className="module-heading"><div><span className="dashboard-eyebrow"><i /> Access control</span><h1>Team</h1><p>Manage workspace members, roles and active access.</p></div>{canManage && <button className="button button-dashboard" onClick={() => setShowCreate((value) => !value)}><Plus size={16} /> Add member</button>}</div>{error && <div className="dashboard-alert">{error}</div>}{showCreate && <form className="dashboard-form-card" onSubmit={submit}><div className="dashboard-form-grid"><label><span>Name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span>Email</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span>Temporary password</span><input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "admin" | "member" })}><option value="member">Member</option><option value="admin">Admin</option></select></label></div><button className="button button-dashboard">Create member</button></form>}{loading ? <div className="module-loading"><LoaderCircle className="spin" /> Loading team</div> : <div className="module-list">{members.map((member) => <article className="module-card team-card" key={member.id}><span className="team-avatar">{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="module-card-main"><h3>{member.name}</h3><p>{member.email}</p><small>{member.is_active ? "Active workspace access" : "Access disabled"}</small></div><span className={`member-state ${member.is_active ? "active" : "inactive"}`}>{member.is_active ? <UserRoundCheck size={14} /> : <UserRoundX size={14} />}{member.is_active ? "Active" : "Inactive"}</span>{member.role === "owner" ? <span className="owner-badge"><ShieldCheck size={14} /> Owner</span> : <select value={member.role} disabled={!canManage} onChange={(event) => void changeRole(member, event.target.value as "admin" | "member")}><option value="member">Member</option><option value="admin">Admin</option></select>}{canManage && member.role !== "owner" && <button className="icon-button" onClick={() => void toggle(member)} aria-label="Toggle member access">{member.is_active ? <UserRoundX size={16} /> : <UserRoundCheck size={16} />}</button>}</article>)}</div>}</DashboardShell>;
}
