"use client";

import { motion } from "framer-motion";
import { Activity, Bell, CalendarDays, ChevronDown, CircleUserRound, LayoutDashboard, MessageSquareText, Search, Settings2, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

const nav = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: UsersRound, label: "Opportunities" },
  { icon: MessageSquareText, label: "Conversations" },
  { icon: CalendarDays, label: "Appointments" },
  { icon: Activity, label: "Intelligence" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-app">
      <aside className="dashboard-sidebar">
        <BrandMark />
        <nav>
          <span className="sidebar-label">Workspace</span>
          {nav.map((item) => { const Icon = item.icon; return <button className={item.active ? "active" : ""} key={item.label}><Icon size={18} /><span>{item.label}</span>{item.active && <i />}</button>; })}
          <span className="sidebar-label second">Manage</span>
          <button><Settings2 size={18} /><span>Automations</span></button>
          <button><CircleUserRound size={18} /><span>Team</span></button>
        </nav>
        <div className="sidebar-upgrade">
          <Sparkles size={18} />
          <strong>Make Vireqo yours</strong>
          <p>Connect your website and customise the concierge.</p>
          <button>Configure system</button>
        </div>
        <Link className="back-site" href="/">← Return to website</Link>
      </aside>
      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div className="workspace-switch"><span className="workspace-avatar">V</span><div><small>Workspace</small><strong>Vireqo Demo Studio</strong></div><ChevronDown size={15} /></div>
          <div className="topbar-actions"><button className="dashboard-search"><Search size={17} /><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-button"><Bell size={18} /><i /></button><div className="user-chip">DT</div></div>
        </header>
        <motion.main className="dashboard-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{children}</motion.main>
      </div>
    </div>
  );
}
