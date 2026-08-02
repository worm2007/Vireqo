"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { getAuditLogs } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import {
  Activity,
  CalendarClock,
  Filter,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const actionCopy: Record<string, { title: string; category: string }> = {
  "auth.register": { title: "Workspace account created", category: "Security" },
  "auth.login": { title: "User signed in", category: "Security" },
  "auth.demo_login": { title: "Demo workspace accessed", category: "Security" },
  "auth.logout": { title: "User signed out", category: "Security" },
  "auth.password_changed": { title: "Password changed", category: "Security" },
  "auth.password_reset_requested": { title: "Password reset requested", category: "Security" },
  "auth.password_reset_completed": { title: "Password reset completed", category: "Security" },
  "auth.refresh": { title: "Session refreshed", category: "Security" },
  "business.updated": { title: "Workspace settings updated", category: "Workspace" },
  "team.member_created": { title: "Team member created", category: "Team" },
  "team.member_updated": { title: "Team member updated", category: "Team" },
  "lead.created": { title: "Opportunity created", category: "CRM" },
  "lead.updated": { title: "Opportunity updated", category: "CRM" },
  "lead.deleted": { title: "Opportunity deleted", category: "CRM" },
  "appointment.updated": { title: "Appointment updated", category: "Appointments" },
  "appointment.deleted": { title: "Appointment deleted", category: "Appointments" },
  "conversation.deleted": { title: "Conversation deleted", category: "Conversations" },
};

function prettifyAction(action: string) {
  return actionCopy[action] ?? {
    title: action.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    category: "Other",
  };
}

function parseDetails(raw: string): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).map(([key, value]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      const readable = Array.isArray(value) ? value.join(", ") : String(value);
      return `${label}: ${readable}`;
    });
  } catch {
    return [raw];
  }
}

function relativeTime(value: string): string {
  const created = new Date(value).getTime();
  const difference = Date.now() - created;
  const minutes = Math.max(0, Math.floor(difference / 60_000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("30");
  const [showSessionNoise, setShowSessionNoise] = useState(false);

  useEffect(() => {
    getAuditLogs(300)
      .then(setLogs)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load workspace activity"),
      )
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () =>
      Array.from(new Set(logs.map((log) => prettifyAction(log.action).category))).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const clean = search.trim().toLowerCase();
    const periodDays = Number(period);
    const cutoff = periodDays ? Date.now() - periodDays * 86_400_000 : 0;

    return logs.filter((log) => {
      const copy = prettifyAction(log.action);
      const details = parseDetails(log.details).join(" ");
      const matchesSearch =
        !clean ||
        `${copy.title} ${copy.category} ${details} ${log.ip_address} ${log.entity_type}`
          .toLowerCase()
          .includes(clean);
      const matchesCategory = !category || copy.category === category;
      const matchesPeriod = !cutoff || new Date(log.created_at).getTime() >= cutoff;
      const matchesNoise = showSessionNoise || log.action !== "auth.refresh";

      return matchesSearch && matchesCategory && matchesPeriod && matchesNoise;
    });
  }, [logs, search, category, period, showSessionNoise]);

  return (
    <DashboardShell>
      <div className="module-heading">
        <div>
          <span className="dashboard-eyebrow">
            <i /> Security and accountability
          </span>
          <h1>Activity log</h1>
          <p>Review important security, team and CRM changes across your workspace.</p>
        </div>
      </div>

      {error && <div className="dashboard-alert">{error}</div>}

      <div className="activity-summary-grid">
        <article>
          <ShieldCheck size={18} />
          <div>
            <strong>{logs.filter((log) => log.action.startsWith("auth.")).length}</strong>
            <span>Security events</span>
          </div>
        </article>
        <article>
          <Activity size={18} />
          <div>
            <strong>{logs.length}</strong>
            <span>Total recorded actions</span>
          </div>
        </article>
        <article>
          <CalendarClock size={18} />
          <div>
            <strong>{filtered.length}</strong>
            <span>Visible in this view</span>
          </div>
        </article>
      </div>

      <div className="module-toolbar activity-toolbar">
        <label className="module-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search actions, fields or IP address"
          />
        </label>

        <label className="activity-filter-select">
          <Filter size={14} />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="0">All time</option>
        </select>

        <label className="activity-toggle">
          <input
            type="checkbox"
            checked={showSessionNoise}
            onChange={(event) => setShowSessionNoise(event.target.checked)}
          />
          <span>Show token refreshes</span>
        </label>
      </div>

      {loading ? (
        <div className="module-loading">
          <LoaderCircle className="spin" /> Loading activity
        </div>
      ) : (
        <div className="activity-list">
          {filtered.map((log) => {
            const copy = prettifyAction(log.action);
            const details = parseDetails(log.details);

            return (
              <article className="activity-card" key={log.id}>
                <span className={`activity-category activity-${copy.category.toLowerCase()}`}>
                  {copy.category}
                </span>

                <div className="activity-card-main">
                  <div className="activity-title-row">
                    <h3>{copy.title}</h3>
                    <time title={new Date(log.created_at).toLocaleString()}>
                      {relativeTime(log.created_at)}
                    </time>
                  </div>

                  <p>
                    {log.entity_type || "workspace"}
                    {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                    {log.ip_address ? ` · ${log.ip_address}` : ""}
                  </p>

                  {details.length > 0 && (
                    <div className="activity-details">
                      {details.map((detail) => (
                        <span key={detail}>{detail}</span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="module-empty">No activity matches these filters.</div>
      )}
    </DashboardShell>
  );
}
