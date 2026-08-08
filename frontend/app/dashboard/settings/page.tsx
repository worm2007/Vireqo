"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { ToastStack, type PolishToast } from "@/components/PolishKit";
import {
  changePassword,
  clearSession,
  deleteAccount,
  getAccountExport,
  getAccountExportSummary,
  getBusiness,
  getCurrentUser,
  updateBusiness,
  updateProfile,
} from "@/lib/api";
import type { AccountExportSummary, Business, User } from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MailCheck,
  Palette,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const DELETE_CONFIRMATION = "DELETE MY WORKSPACE";

function addToast(setter: (callback: (items: PolishToast[]) => PolishToast[]) => void, toast: Omit<PolishToast, "id">) {
  const id = crypto.randomUUID();
  setter((current) => [{ ...toast, id }, ...current].slice(0, 4));
  window.setTimeout(() => setter((current) => current.filter((item) => item.id !== id)), 4200);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [summary, setSummary] = useState<AccountExportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<PolishToast[]>([]);

  const [profileName, setProfileName] = useState("");
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    industry: "",
    website: "",
    brand_color: "#C7FF42",
    greeting: "",
    description: "",
  });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "" });
  const [dangerForm, setDangerForm] = useState({ password: "", confirmation: "" });

  const canDeleteWorkspace = user?.role === "owner";
  const verifiedLabel = user?.is_email_verified ? "Verified" : "Not verified";

  const exportCards = useMemo(
    () => [
      ["Users", summary?.users ?? 0],
      ["Leads", summary?.leads ?? 0],
      ["Conversations", summary?.conversations ?? 0],
      ["Appointments", summary?.appointments ?? 0],
      ["Tasks", summary?.tasks ?? 0],
      ["Audit logs", summary?.audit_logs ?? 0],
    ],
    [summary],
  );

  async function load() {
    setLoading(true);
    try {
      const [currentUser, currentBusiness, exportSummary] = await Promise.all([
        getCurrentUser(),
        getBusiness(),
        getAccountExportSummary(),
      ]);
      setUser(currentUser);
      setBusiness(currentBusiness);
      setSummary(exportSummary);
      setProfileName(currentUser.name);
      setWorkspaceForm({
        name: currentBusiness.name,
        industry: currentBusiness.industry,
        website: currentBusiness.website,
        brand_color: currentBusiness.brand_color,
        greeting: currentBusiness.greeting,
        description: currentBusiness.description,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load settings";
      if (/session|authentication|expired|sign in/i.test(message)) {
        clearSession();
        router.replace("/login");
        return;
      }
      addToast(setToasts, { tone: "error", title: "Settings failed to load", message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateProfile(profileName);
      setUser(updated);
      addToast(setToasts, { tone: "success", title: "Profile updated", message: "Your account name was saved." });
    } catch (error) {
      addToast(setToasts, {
        tone: "error",
        title: "Profile update failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveWorkspace(event: FormEvent) {
    event.preventDefault();
    setSavingWorkspace(true);
    try {
      const updated = await updateBusiness(workspaceForm);
      setBusiness(updated);
      setWorkspaceForm({
        name: updated.name,
        industry: updated.industry,
        website: updated.website,
        brand_color: updated.brand_color,
        greeting: updated.greeting,
        description: updated.description,
      });
      addToast(setToasts, { tone: "success", title: "Workspace updated", message: "Brand and concierge settings were saved." });
    } catch (error) {
      addToast(setToasts, {
        tone: "error",
        title: "Workspace update failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setSavingPassword(true);
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      addToast(setToasts, { tone: "success", title: "Password changed", message: "Sign in again with your new password." });
      router.replace("/login");
    } catch (error) {
      addToast(setToasts, {
        tone: "error",
        title: "Password change failed",
        message: error instanceof Error ? error.message : "Check your current password.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const data = await getAccountExport();
      downloadJson(`vireqo-${data.business.slug}-export.json`, data);
      const freshSummary = await getAccountExportSummary();
      setSummary(freshSummary);
      addToast(setToasts, { tone: "success", title: "Export downloaded", message: "Your workspace data was saved as JSON." });
    } catch (error) {
      addToast(setToasts, {
        tone: "error",
        title: "Export failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setExporting(false);
    }
  }

  async function submitDelete(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    try {
      await deleteAccount(dangerForm);
      addToast(setToasts, { tone: "success", title: "Workspace deleted", message: "Your account data has been removed." });
      router.replace("/signup");
    } catch (error) {
      addToast(setToasts, {
        tone: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Check your password and confirmation phrase.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardShell>
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />

      <main className="settings-page">
        <section className="settings-hero">
          <div>
            <span className="eyebrow"><ShieldCheck size={14} /> Account control center</span>
            <h1>Settings, privacy and workspace ownership</h1>
            <p>Manage your profile, configure your Vireqo workspace, export your data and control account deletion from one secure place.</p>
          </div>
          <div className="settings-hero-card">
            <small>Signed in as</small>
            <strong>{user?.email ?? "Loading..."}</strong>
            <span className={user?.is_email_verified ? "verified-pill success" : "verified-pill warning"}>
              <MailCheck size={14} /> {verifiedLabel}
            </span>
          </div>
        </section>

        {loading ? (
          <div className="settings-loading">
            <LoaderCircle className="spin" size={28} />
            <strong>Loading account settings</strong>
          </div>
        ) : (
          <div className="settings-grid">
            <form className="settings-card" onSubmit={saveProfile}>
              <div className="settings-card-head">
                <span><UserRound size={18} /></span>
                <div>
                  <h2>Profile</h2>
                  <p>Update the name shown inside your workspace.</p>
                </div>
              </div>
              <label>
                Name
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} minLength={2} maxLength={120} required />
              </label>
              <label>
                Email
                <input value={user?.email ?? ""} disabled />
              </label>
              <div className="settings-inline-meta">
                <span>Role: <strong>{user?.role}</strong></span>
                <span>Status: <strong>{user?.is_active ? "Active" : "Inactive"}</strong></span>
              </div>
              <button className="button button-dashboard" type="submit" disabled={savingProfile}>
                {savingProfile && <LoaderCircle className="spin" size={16} />}
                Save profile
              </button>
            </form>

            <form className="settings-card settings-card-wide" onSubmit={saveWorkspace}>
              <div className="settings-card-head">
                <span><Palette size={18} /></span>
                <div>
                  <h2>Workspace brand</h2>
                  <p>These details power the CRM workspace and public AI concierge.</p>
                </div>
              </div>
              <div className="settings-two-cols">
                <label>
                  Workspace name
                  <input value={workspaceForm.name} onChange={(event) => setWorkspaceForm((form) => ({ ...form, name: event.target.value }))} minLength={2} maxLength={160} required />
                </label>
                <label>
                  Industry
                  <input value={workspaceForm.industry} onChange={(event) => setWorkspaceForm((form) => ({ ...form, industry: event.target.value }))} minLength={2} maxLength={100} required />
                </label>
                <label>
                  Website
                  <input value={workspaceForm.website} onChange={(event) => setWorkspaceForm((form) => ({ ...form, website: event.target.value }))} maxLength={255} placeholder="https://example.com" />
                </label>
                <label>
                  Brand color
                  <input type="color" value={workspaceForm.brand_color} onChange={(event) => setWorkspaceForm((form) => ({ ...form, brand_color: event.target.value }))} />
                </label>
              </div>
              <label>
                AI concierge greeting
                <textarea value={workspaceForm.greeting} onChange={(event) => setWorkspaceForm((form) => ({ ...form, greeting: event.target.value }))} rows={3} maxLength={1000} />
              </label>
              <label>
                Workspace description
                <textarea value={workspaceForm.description} onChange={(event) => setWorkspaceForm((form) => ({ ...form, description: event.target.value }))} rows={4} maxLength={5000} />
              </label>
              <button className="button button-dashboard" type="submit" disabled={savingWorkspace}>
                {savingWorkspace && <LoaderCircle className="spin" size={16} />}
                Save workspace
              </button>
            </form>

            <form className="settings-card" onSubmit={submitPassword}>
              <div className="settings-card-head">
                <span><KeyRound size={18} /></span>
                <div>
                  <h2>Password</h2>
                  <p>Change your password and sign in again.</p>
                </div>
              </div>
              <label>
                Current password
                <input type="password" value={passwordForm.current} onChange={(event) => setPasswordForm((form) => ({ ...form, current: event.target.value }))} required />
              </label>
              <label>
                New password
                <input type="password" value={passwordForm.next} onChange={(event) => setPasswordForm((form) => ({ ...form, next: event.target.value }))} minLength={8} required />
              </label>
              <button className="button button-dashboard" type="submit" disabled={savingPassword}>
                {savingPassword && <LoaderCircle className="spin" size={16} />}
                Change password
              </button>
            </form>

            <section className="settings-card settings-card-wide">
              <div className="settings-card-head">
                <span><Download size={18} /></span>
                <div>
                  <h2>Data export</h2>
                  <p>Download a JSON copy of your workspace for backup, portability or audit review.</p>
                </div>
              </div>
              <div className="export-summary-grid">
                {exportCards.map(([label, value]) => (
                  <div className="export-summary-card" key={String(label)}>
                    <small>{label}</small>
                    <strong>{formatCount(Number(value))}</strong>
                  </div>
                ))}
              </div>
              <button className="button button-dashboard" type="button" onClick={exportData} disabled={exporting}>
                {exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
                Download JSON export
              </button>
            </section>

            <form className="settings-card danger-settings" onSubmit={submitDelete}>
              <div className="settings-card-head">
                <span><AlertTriangle size={18} /></span>
                <div>
                  <h2>Danger zone</h2>
                  <p>Delete the entire workspace and all related CRM data.</p>
                </div>
              </div>
              <div className="danger-note">
                <Trash2 size={18} />
                <p>This permanently removes users, leads, conversations, appointments, tasks and audit logs for this workspace.</p>
              </div>
              {!canDeleteWorkspace && (
                <div className="danger-note muted">
                  <LockKeyhole size={18} />
                  <p>Only the workspace owner can delete this workspace.</p>
                </div>
              )}
              <label>
                Password
                <input type="password" value={dangerForm.password} onChange={(event) => setDangerForm((form) => ({ ...form, password: event.target.value }))} disabled={!canDeleteWorkspace} required />
              </label>
              <label>
                Type {DELETE_CONFIRMATION}
                <input value={dangerForm.confirmation} onChange={(event) => setDangerForm((form) => ({ ...form, confirmation: event.target.value }))} disabled={!canDeleteWorkspace} required />
              </label>
              <button className="button button-danger" type="submit" disabled={!canDeleteWorkspace || deleting || dangerForm.confirmation !== DELETE_CONFIRMATION}>
                {deleting && <LoaderCircle className="spin" size={16} />}
                Delete workspace forever
              </button>
            </form>
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
