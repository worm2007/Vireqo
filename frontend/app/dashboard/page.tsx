"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { LeadTable } from "@/components/LeadTable";
import {
  clearSession,
  getAnalytics,
  getCurrentUser,
  getExecutiveInsights,
  getLeads,
  updateLeadStatus,
} from "@/lib/api";
import type { Analytics, ExecutiveInsights, Lead, User } from "@/lib/types";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  Flame,
  Gauge,
  LoaderCircle,
  MessageSquareText,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const chartByRange = {
  7: [42, 50, 47, 61, 66, 73, 82],
  30: [28, 42, 34, 56, 49, 71, 65, 84, 77, 94, 88, 106],
  90: [20, 25, 32, 29, 43, 48, 55, 62, 58, 74, 82, 91, 99, 108, 118],
} as const;

type RangeDays = keyof typeof chartByRange;

export default function DashboardPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [insights, setInsights] = useState<ExecutiveInsights | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  async function load() {
    try {
      const [currentUser, summary, executive, items] = await Promise.all([
        getCurrentUser(),
        getAnalytics(),
        getExecutiveInsights(),
        getLeads({ limit: 100 }),
      ]);
      setUser(currentUser);
      setAnalytics(summary);
      setInsights(executive);
      setLeads(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load the dashboard";
      if (/session|authentication|expired|sign in/i.test(message)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function changeStatus(lead: Lead, status: Lead["status"]) {
    const previous = lead.status;
    setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status } : item));
    try {
      await updateLeadStatus(lead.id, status);
      const [summary, executive] = await Promise.all([getAnalytics(), getExecutiveInsights()]);
      setAnalytics(summary);
      setInsights(executive);
    } catch {
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status: previous } : item));
      setError("Status update failed. The previous value was restored.");
    }
  }

  const chart = useMemo(() => chartByRange[rangeDays], [rangeDays]);
  const firstName = user?.name.split(" ")[0] ?? "Founder";

  function cycleRange() {
    setRangeDays((current) => current === 7 ? 30 : current === 30 ? 90 : 7);
  }

  return (
    <DashboardShell>
      {!analytics || !insights ? (
        <div className="dashboard-loading"><LoaderCircle className="spin" size={28} /><strong>Preparing your executive intelligence</strong><p>{error || "Analysing your workspace…"}</p></div>
      ) : (
        <>
          <div className="dashboard-welcome">
            <div><span className="dashboard-eyebrow"><i /> AI executive workspace</span><h1>Good evening, {firstName}.</h1><p>{insights.executive_summary}</p></div>
            <Link className="button button-dashboard" href="/dashboard/ai-assistant"><Sparkles size={17} /> Open AI briefing</Link>
          </div>
          {error && <div className="dashboard-alert">{error}</div>}

          <section className="executive-hero-card">
            <div className="executive-summary-copy">
              <span className="executive-kicker"><Sparkles size={14} /> Executive briefing</span>
              <h2>{insights.health.label} momentum across your workspace.</h2>
              <p>{insights.executive_summary}</p>
              <Link href={insights.recommended_action.href} className="executive-action-link">
                <span><small>Recommended next action</small><strong>{insights.recommended_action.title}</strong><em>{insights.recommended_action.detail}</em></span>
                <ArrowRight size={18} />
              </Link>
            </div>
            <div className="health-score-panel">
              <div className="health-score-ring" style={{ "--health": insights.health.score } as React.CSSProperties}>
                <div><strong>{insights.health.score}</strong><span>/ 100</span></div>
              </div>
              <div><small>Business health</small><h3>{insights.health.label}</h3><p>Calculated from live CRM signals.</p></div>
            </div>
          </section>

          <div className="executive-layout-grid">
            <section className="priority-panel">
              <div className="executive-panel-heading"><div><span>Today&apos;s focus</span><h3>Ranked priorities</h3></div><Target size={18} /></div>
              <div className="priority-list">
                {insights.priorities.map((priority, index) => (
                  <Link href={priority.href} className={`priority-item urgency-${priority.urgency}`} key={`${priority.title}-${index}`}>
                    <span className="priority-number">{String(index + 1).padStart(2, "0")}</span>
                    <span><strong>{priority.title}</strong><small>{priority.detail}</small></span>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            </section>

            <section className="health-breakdown-panel">
              <div className="executive-panel-heading"><div><span>Business health</span><h3>Signal breakdown</h3></div><Gauge size={18} /></div>
              <div className="health-bars">
                {Object.entries({
                  "Lead quality": insights.health.components.lead_quality,
                  Pipeline: insights.health.components.pipeline,
                  "Follow-up": insights.health.components.follow_up,
                  Appointments: insights.health.components.appointments,
                  "Response speed": insights.health.components.response_speed,
                }).map(([label, value]) => (
                  <div className="health-bar-row" key={label}>
                    <div><span>{label}</span><strong>{value}</strong></div>
                    <i><b style={{ width: `${value}%` }} /></i>
                  </div>
                ))}
              </div>
            </section>

            <section className="smart-notifications-panel">
              <div className="executive-panel-heading"><div><span>AI notification center</span><h3>Signals requiring context</h3></div><BellRing size={18} /></div>
              <div className="smart-notification-list">
                {insights.notifications.length ? insights.notifications.map((notification, index) => (
                  <Link href={notification.href} className={`smart-notification kind-${notification.kind}`} key={`${notification.title}-${index}`}>
                    <span className="notification-symbol"><MessageSquareText size={15} /></span>
                    <span><strong>{notification.title}</strong><small>{notification.detail}</small></span>
                    <ArrowRight size={14} />
                  </Link>
                )) : <div className="executive-empty"><CheckCircle2 size={20} /><strong>No urgent signals</strong><span>Your workspace is clear.</span></div>}
              </div>
            </section>
          </div>

          <div className="metric-grid executive-metric-grid">
            <Metric icon={TrendingUp} label="Pipeline health" value={`${insights.metrics.pipeline_health}%`} trend="Live score" positive />
            <Metric icon={Flame} label="Lead quality" value={`${insights.metrics.lead_quality}%`} trend={`${analytics.temperatures.hot ?? 0} hot`} positive />
            <Metric icon={CalendarCheck2} label="Today&apos;s meetings" value={insights.metrics.today_appointments} trend="Scheduled" positive />
            <Metric icon={Sparkles} label="AI confidence" value={`${insights.metrics.ai_confidence}%`} trend={insights.metrics.top_source} positive />
            <Metric icon={UsersRound} label="Follow-up rate" value={`${insights.metrics.follow_up_rate}%`} trend={`${insights.metrics.overdue_follow_ups} overdue`} positive={insights.metrics.overdue_follow_ups === 0} />
            <Metric icon={Target} label="Weighted forecast" value={insights.metrics.weighted_forecast ?? "Add budgets"} trend={insights.metrics.pipeline_value ? `${insights.metrics.pipeline_value} total` : "Budget data needed"} positive />
          </div>

          <div className="dashboard-insight-grid">
            <section className="pipeline-chart-card">
              <div className="card-heading">
                <div><span>Opportunity velocity</span><h3>{analytics.total_leads * 4 + 18} signals</h3></div>
                <button type="button" onClick={cycleRange} title="Change chart period">Last {rangeDays} days <span>⌄</span></button>
              </div>
              <div className="chart-area">
                <div className="chart-lines">{[0, 1, 2, 3].map((line) => <i key={line} />)}</div>
                <svg viewBox="0 0 600 190" role="img" aria-label={`Opportunity growth chart for the last ${rangeDays} days`}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C7FF42" stopOpacity=".42"/><stop offset="100%" stopColor="#C7FF42" stopOpacity="0"/></linearGradient></defs><path className="chart-fill" d={`M0,${190-chart[0]} ${chart.map((point, index) => `L${index * (600/(chart.length-1))},${190-point}`).join(" ")} L600,190 L0,190Z`} /><path className="chart-line" d={`M0,${190-chart[0]} ${chart.map((point, index) => `L${index * (600/(chart.length-1))},${190-point}`).join(" ")}`} /></svg>
                <div className="chart-labels"><span>Start</span><span>Progress</span><span>Recent</span><span>Today</span></div>
              </div>
            </section>
            <section className="temperature-card">
              <div className="card-heading"><div><span>Lead quality</span><h3>Intent mix</h3></div><Link className="icon-button compact" href="/dashboard/opportunities" aria-label="View all opportunities"><ArrowUpRight size={16} /></Link></div>
              <div className="quality-orbit"><div className="quality-ring"><strong>{analytics.total_leads}</strong><span>total</span></div></div>
              <div className="quality-list"><div><span><i className="hot-dot" />Hot</span><strong>{analytics.temperatures.hot ?? 0}</strong></div><div><span><i className="warm-dot" />Warm</span><strong>{analytics.temperatures.warm ?? 0}</strong></div><div><span><i className="cold-dot" />Cold</span><strong>{analytics.temperatures.cold ?? 0}</strong></div></div>
            </section>
          </div>
          <LeadTable leads={leads} onStatus={changeStatus} />
        </>
      )}
    </DashboardShell>
  );
}

function Metric({ icon: Icon, label, value, trend, positive }: { icon: typeof UsersRound; label: string; value: string | number; trend: string; positive?: boolean }) {
  return <motion.article className="metric-tile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><div className="metric-icon"><Icon size={19} /></div><span>{label}</span><div className="metric-value"><strong>{value}</strong><small className={positive ? "positive" : ""}>{positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{trend}</small></div></motion.article>;
}
