"use client";

import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRealtime, type WorkspaceRealtimeEvent } from "@/hooks/useWorkspaceRealtime";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
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
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
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

const privilegedManage = [
  { icon: ClipboardList, label: "Activity log", href: "/dashboard/activity" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [liveEvents, setLiveEvents] = useState<WorkspaceRealtimeEvent[]>([]);

  const realtimeStatus = useWorkspaceRealtime((event) => {
    setLiveEvents((current) => [event, ...current].slice(0, 6));
  });

  const manageItems = useMemo(
    () =>
      user && (user.role === "owner" || user.role === "admin")
        ? [...manage, ...privilegedManage]
        : manage,
    [user],
  );

  const commandItems = useMemo(() => [...nav, ...manageItems], [manageItems]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationsOpen(false);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setQuery("");
  }, [pathname]);

  const filteredCommands = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return commandItems;
    return commandItems.filter((item) => item.label.toLowerCase().includes(clean));
  }, [query, commandItems]);

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
          {manageItems.map((item) => {
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
          <Link className="workspace-switch" href="/dashboard/settings" title="Open workspace settings">
            <span className="workspace-avatar">{user.business.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <small>Workspace</small>
              <strong>{user.business.name}</strong>
            </div>
            <ChevronDown size={15} />
          </Link>

          <div className="topbar-actions">
            <button
              className="dashboard-search"
              type="button"
              onClick={() => {
                setSearchOpen(true);
                setNotificationsOpen(false);
              }}
              aria-label="Search your workspace"
            >
              <Search size={17} />
              <span>Search your workspace</span>
              <kbd>⌘ K</kbd>
            </button>

            <span className={`realtime-status ${realtimeStatus}`} title={`Workspace connection: ${realtimeStatus}`}>
              <i />
              {realtimeStatus === "live" ? "Live" : realtimeStatus === "connecting" ? "Connecting" : "Reconnecting"}
            </span>

            <div className="notification-anchor">
              <button
                className="icon-button"
                type="button"
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setSearchOpen(false);
                }}
              >
                <Bell size={18} />
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    className="notification-popover"
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  >
                    <div className="notification-popover-head">
                      <div><strong>Workspace activity</strong><span>{realtimeStatus === "live" ? "Updating live across every signed-in tab." : "Reconnecting to live updates."}</span></div>
                      <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={15} /></button>
                    </div>
                    {liveEvents.length > 0 && (
                      <div className="live-event-list">
                        {liveEvents.slice(0, 3).map((event) => (
                          <div className="live-event-item" key={event.id ?? `${event.type}-${event.occurred_at}`}>
                            <span><i /></span>
                            <div>
                              <strong>{formatLiveEvent(event)}</strong>
                              <small>Just now</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Link href="/dashboard/conversations">
                      <MessageSquareText size={17} />
                      <div><strong>Review conversations</strong><span>Check the latest visitor exchanges.</span></div>
                      <ArrowUpRight size={14} />
                    </Link>
                    <Link href="/dashboard/appointments">
                      <CalendarDays size={17} />
                      <div><strong>Review appointments</strong><span>Manage upcoming calls and outcomes.</span></div>
                      <ArrowUpRight size={14} />
                    </Link>
                    {(user.role === "owner" || user.role === "admin") && (
                      <Link href="/dashboard/activity">
                        <ClipboardList size={17} />
                        <div><strong>Review activity log</strong><span>Inspect recent security and CRM changes.</span></div>
                        <ArrowUpRight size={14} />
                      </Link>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="command-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setSearchOpen(false)}
          >
            <motion.section
              className="command-palette"
              initial={{ opacity: 0, y: -18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Search workspace"
            >
              <div className="command-input-wrap">
                <Search size={18} />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search pages and tools…"
                />
                <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={17} /></button>
              </div>

              <div className="command-results">
                {filteredCommands.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link href={item.href} key={item.href}>
                      <span><Icon size={17} /></span>
                      <div><strong>{item.label}</strong><small>{item.href}</small></div>
                      <ArrowUpRight size={15} />
                    </Link>
                  );
                })}
                {filteredCommands.length === 0 && <p>No workspace page matches “{query}”.</p>}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function formatLiveEvent(event: WorkspaceRealtimeEvent): string {
  const name = typeof event.payload.name === "string" ? event.payload.name : "Workspace";
  if (event.type === "lead.created") return `${name} added as an opportunity`;
  if (event.type === "lead.updated") return `${name} opportunity updated`;
  if (event.type === "lead.deleted") return `${name} opportunity removed`;
  if (event.type === "appointment.created") return `Appointment booked for ${name}`;
  if (event.type === "appointment.updated") return `Appointment updated for ${name}`;
  if (event.type === "appointment.deleted") return `Appointment removed for ${name}`;
  if (event.type.startsWith("conversation.")) return "Conversation activity received";
  return typeof event.payload.label === "string" ? event.payload.label : "Workspace updated";
}
