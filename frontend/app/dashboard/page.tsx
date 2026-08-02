"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { LeadTable } from "@/components/LeadTable";
import { clearSession, getAnalytics, getCurrentUser, getLeads, updateLeadStatus } from "@/lib/api";
import type { Analytics, Lead, User } from "@/lib/types";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, CalendarCheck2, Flame, LoaderCircle, Sparkles, Target, UsersRound } from "lucide-react";
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  async function load() {
    try {
      const [currentUser, summary, items] = await Promise.all([
        getCurrentUser(),
        getAnalytics(),
        getLeads({ limit: 100 }),
      ]);
      setUser(currentUser);
      setAnalytics(summary);
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
      setAnalytics(await getAnalytics());
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
      {!analytics ? (
        <div className="dashboard-loading"><LoaderCircle className="spin" size={28} /><strong>Preparing your opportunity intelligence</strong><p>{error || "Connecting to the Vireqo API…"}</p></div>
      ) : (
        <>
          <div className="dashboard-welcome">
            <div><span className="dashboard-eyebrow"><i /> Live workspace</span><h1>Good evening, {firstName}.</h1><p>Your pipeline has <strong>{analytics.temperatures.hot ?? 0} high-intent opportunities</strong> ready for attention.</p></div>
            <Link className="button button-dashboard" href="/dashboard/ai-assistant"><Sparkles size={17} /> Open AI briefing</Link>
          </div>
          {error && <div className="dashboard-alert">{error}</div>}
          <div className="metric-grid">
            <Metric icon={UsersRound} label="Total opportunities" value={analytics.total_leads} trend="Live" positive />
            <Metric icon={Flame} label="High-intent leads" value={analytics.temperatures.hot ?? 0} trend="Prioritised" positive />
            <Metric icon={CalendarCheck2} label="Appointments" value={analytics.appointments} trend="All time" positive />
            <Metric icon={Target} label="Average intent" value={`${analytics.average_score}`} trend="/ 100" positive />
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
