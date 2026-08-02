"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { createTeamMember, getCurrentUser, getTeam, updateTeamMember } from "@/lib/api";
import type { TeamMember, User } from "@/lib/types";
import {
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type CreatedCredential = {
  name: string;
  email: string;
  password: string;
};

function createTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = crypto.getRandomValues(new Uint32Array(12));
  const random = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `Vr9!${random}`;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [createdCredential, setCreatedCredential] = useState<CreatedCredential | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "member" as "admin" | "member",
  });

  useEffect(() => {
    Promise.all([getTeam(), getCurrentUser()])
      .then(([team, currentUser]) => {
        setMembers(team);
        setUser(currentUser);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load team"))
      .finally(() => setLoading(false));
  }, []);

  const canManage = user?.role === "owner" || user?.role === "admin";

  const filteredMembers = useMemo(() => {
    const clean = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !clean || `${member.name} ${member.email}`.toLowerCase().includes(clean);
      const matchesRole = !roleFilter || member.role === roleFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" ? member.is_active : !member.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, search, roleFilter, statusFilter]);

  function openCreate() {
    setError("");
    setSuccess("");
    setCreatedCredential(null);
    setShowCreate(true);
    setForm({
      name: "",
      email: "",
      password: createTemporaryPassword(),
      role: "member",
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const member = await createTeamMember(form);
      setMembers((current) => [...current, member]);
      setCreatedCredential({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      setForm({ name: "", email: "", password: "", role: "member" });
      setShowCreate(false);
      setSuccess("Team member created. Share the temporary credentials securely.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create team member");
    } finally {
      setSaving(false);
    }
  }

  async function copyCredentials() {
    if (!createdCredential) return;

    const content = [
      `Vireqo workspace access for ${createdCredential.name}`,
      `Email: ${createdCredential.email}`,
      `Temporary password: ${createdCredential.password}`,
      "Sign in and change this password immediately.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy credentials. Copy them manually before dismissing this card.");
    }
  }

  async function toggle(member: TeamMember) {
    const verb = member.is_active ? "disable" : "restore";
    if (!window.confirm(`Are you sure you want to ${verb} access for ${member.name}?`)) return;

    setError("");
    setSuccess("");

    try {
      const updated = await updateTeamMember(member.id, { is_active: !member.is_active });
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? updated : item)),
      );
      setSuccess(`${updated.name}'s access is now ${updated.is_active ? "active" : "disabled"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update team member");
    }
  }

  async function changeRole(member: TeamMember, role: "admin" | "member") {
    setError("");
    setSuccess("");

    try {
      const updated = await updateTeamMember(member.id, { role });
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? updated : item)),
      );
      setSuccess(`${updated.name} is now a workspace ${updated.role}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update role");
    }
  }

  function startEditing(member: TeamMember) {
    setEditingId(member.id);
    setEditingName(member.name);
    setError("");
    setSuccess("");
  }

  async function saveName(member: TeamMember) {
    const clean = editingName.trim();
    if (clean.length < 2) {
      setError("Team member name must contain at least two characters.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = await updateTeamMember(member.id, { name: clean });
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? updated : item)),
      );
      setEditingId(null);
      setEditingName("");
      setSuccess("Team member profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update team member");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell>
      <div className="module-heading">
        <div>
          <span className="dashboard-eyebrow">
            <i /> Access control
          </span>
          <h1>Team</h1>
          <p>Manage workspace members, roles and active access.</p>
        </div>

        {canManage && (
          <button
            className="button button-dashboard"
            type="button"
            onClick={() => (showCreate ? setShowCreate(false) : openCreate())}
          >
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            {showCreate ? "Cancel" : "Add member"}
          </button>
        )}
      </div>

      {error && <div className="dashboard-alert">{error}</div>}
      {success && <div className="dashboard-success">{success}</div>}

      {createdCredential && (
        <section className="credential-card">
          <div className="credential-icon">
            <KeyRound size={20} />
          </div>
          <div className="credential-content">
            <span>One-time credential summary</span>
            <h3>{createdCredential.name}</h3>
            <p>{createdCredential.email}</p>
            <code>{createdCredential.password}</code>
            <small>For security, this password is shown only in this temporary card.</small>
          </div>
          <div className="credential-actions">
            <button className="button button-dashboard" type="button" onClick={() => void copyCredentials()}>
              {copied ? <Check size={15} /> : <Clipboard size={15} />}
              {copied ? "Copied" : "Copy credentials"}
            </button>
            <button className="icon-button" type="button" onClick={() => setCreatedCredential(null)} aria-label="Dismiss credentials">
              <X size={16} />
            </button>
          </div>
        </section>
      )}

      {showCreate && (
        <form className="dashboard-form-card" onSubmit={submit}>
          <div className="settings-card-title">
            <Plus size={18} />
            <div>
              <h3>Create team member</h3>
              <p>The temporary password can be regenerated before creating the account.</p>
            </div>
          </div>

          <div className="dashboard-form-grid">
            <label>
              <span>Name</span>
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <label>
              <span>Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>

            <label>
              <span>Temporary password</span>
              <div className="password-generator-field">
                <input
                  required
                  minLength={8}
                  type="text"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: createTemporaryPassword() })}
                >
                  Generate
                </button>
              </div>
            </label>

            <label>
              <span>Role</span>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as "admin" | "member" })
                }
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>

          <button className="button button-dashboard" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
            {saving ? "Creating..." : "Create member"}
          </button>
        </form>
      )}

      <div className="module-toolbar team-toolbar">
        <label className="module-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search team members"
          />
        </label>

        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>

        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All access states</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="module-loading">
          <LoaderCircle className="spin" /> Loading team
        </div>
      ) : (
        <div className="module-list">
          {filteredMembers.map((member) => (
            <article className="module-card team-card" key={member.id}>
              <span className="team-avatar">
                {member.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>

              <div className="module-card-main team-member-main">
                {editingId === member.id ? (
                  <div className="team-name-editor">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveName(member);
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button type="button" onClick={() => void saveName(member)} disabled={saving} aria-label="Save member name">
                      <Save size={15} />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel member edit">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="team-member-name-row">
                    <h3>{member.name}</h3>
                    {canManage && member.role !== "owner" && (
                      <button type="button" onClick={() => startEditing(member)} aria-label={`Edit ${member.name}`}>
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                )}
                <p>{member.email}</p>
                <small>{member.is_active ? "Active workspace access" : "Access disabled"}</small>
              </div>

              <span className={`member-state ${member.is_active ? "active" : "inactive"}`}>
                {member.is_active ? <UserRoundCheck size={14} /> : <UserRoundX size={14} />}
                {member.is_active ? "Active" : "Inactive"}
              </span>

              {member.role === "owner" ? (
                <span className="owner-badge">
                  <ShieldCheck size={14} /> Owner
                </span>
              ) : (
                <select
                  value={member.role}
                  disabled={!canManage}
                  onChange={(event) =>
                    void changeRole(member, event.target.value as "admin" | "member")
                  }
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              )}

              {canManage && member.role !== "owner" && (
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => void toggle(member)}
                  aria-label={member.is_active ? `Disable ${member.name}` : `Restore ${member.name}`}
                  title={member.is_active ? "Disable access" : "Restore access"}
                >
                  {member.is_active ? <UserRoundX size={16} /> : <UserRoundCheck size={16} />}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && filteredMembers.length === 0 && (
        <div className="module-empty">No team members match these filters.</div>
      )}
    </DashboardShell>
  );
}
