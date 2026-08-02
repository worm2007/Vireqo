"use client";

import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleUserRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Search,
  Settings2,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

const nav = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: Bot, label: "Chat with AI", href: "/dashboard/ai-assistant" },
  { icon: UsersRound, label: "Opportunities", href: "/dashboard/opportunities" },
  { icon: MessageSquareText, label: "Conversations", href: "/dashboard/conversations" },
  { icon: CalendarDays, label: "Appointments", href: "/dashboard/appointments" },
];

const manage = [
  { icon: Settings2, label: "Settings", href: "/dashboard/settings" },
  { icon: CircleUserRound, label: "Team", href: "/dashboard/team" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  if (loading || !user) {
    return (
      <div className="dashboard-auth-loading">
        <LoaderCircle className="spin" size={28} />
        <strong>Securing your Vireqo workspace</strong>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="dashboard-app">
      <aside className="dashboard-sidebar">
        <BrandMark />
        <nav>
          <span className="sidebar-label">Workspace</span>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link className={`dashboard-nav-item ${active ? "active" : ""}`} href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
                {active && <i />}
              </Link>
            );
          })}
          <span className="sidebar-label second">Manage</span>
          {manage.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link className={`dashboard-nav-item ${active ? "active" : ""}`} href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
                {active && <i />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-upgrade">
          <Sparkles size={18} />
          <strong>Make Vireqo yours</strong>
          <p>Configure your brand, concierge greeting and workspace settings.</p>
          <Link href="/dashboard/settings">Configure system</Link>
        </div>
        <Link className="back-site" href="/">← Return to website</Link>
      </aside>
      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div className="workspace-switch">
            <span className="workspace-avatar">{user.business.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <small>Workspace</small>
              <strong>{user.business.name}</strong>
            </div>
            <ChevronDown size={15} />
          </div>
          <div className="topbar-actions">
            <button className="dashboard-search" type="button">
              <Search size={17} />
              <span>Search your workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <button className="icon-button" type="button" aria-label="Notifications">
              <Bell size={18} />
              <i />
            </button>
            <span className="user-chip" title={`${user.name} · ${user.role}`}>{initials}</span>
            <button className="icon-button logout-button" type="button" aria-label="Sign out" onClick={() => void signOut()}>
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <motion.main className="dashboard-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {children}
        </motion.main>
      </div>
    </div>
  );
}
