"use client";

import { sendWorkspaceChat } from "@/lib/api";
import type { ChatResponse } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Command,
  Copy,
  FileText,
  Flame,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Search,
  Settings2,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  KeyboardEvent,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const RECENT_COMMANDS_KEY = "vireqo-command-center-recents";
const COMMAND_SESSION_KEY = "vireqo-command-center-session";

type CommandIntent = "navigate" | "ai" | "prefill";

type CommandItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  intent: CommandIntent;
  href?: string;
  prompt?: string;
  template?: string;
  keywords: string[];
};

type RecentCommand = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

type CommandCenterProps = {
  open: boolean;
  onClose: () => void;
  canViewActivity: boolean;
  workspaceName: string;
};

const baseNavigation: CommandItem[] = [
  {
    id: "nav-dashboard",
    title: "Open dashboard",
    description: "Go to the executive workspace overview.",
    icon: LayoutDashboard,
    intent: "navigate",
    href: "/dashboard",
    keywords: ["overview", "home", "metrics", "executive", "insights"],
  },
  {
    id: "nav-ai",
    title: "Open AI assistant",
    description: "Chat with Vireqo AI and run CRM actions.",
    icon: Bot,
    intent: "navigate",
    href: "/dashboard/ai-assistant",
    keywords: ["ai", "assistant", "chat", "copilot", "vireqo"],
  },
  {
    id: "nav-leads",
    title: "Open opportunities",
    description: "Manage, edit and qualify leads.",
    icon: UsersRound,
    intent: "navigate",
    href: "/dashboard/opportunities",
    keywords: ["lead", "leads", "crm", "opportunities", "pipeline"],
  },
  {
    id: "nav-conversations",
    title: "Open conversations",
    description: "Review AI and visitor conversation history.",
    icon: MessageSquareText,
    intent: "navigate",
    href: "/dashboard/conversations",
    keywords: ["messages", "chat", "transcripts", "conversation"],
  },
  {
    id: "nav-appointments",
    title: "Open appointments",
    description: "View calls, meetings and scheduled follow-ups.",
    icon: CalendarDays,
    intent: "navigate",
    href: "/dashboard/appointments",
    keywords: ["calendar", "meeting", "bookings", "schedule"],
  },
  {
    id: "nav-team",
    title: "Open team",
    description: "Manage workspace members and roles.",
    icon: UsersRound,
    intent: "navigate",
    href: "/dashboard/team",
    keywords: ["members", "roles", "users", "invite"],
  },
  {
    id: "nav-settings",
    title: "Open settings",
    description: "Configure workspace, AI greeting and business profile.",
    icon: Settings2,
    intent: "navigate",
    href: "/dashboard/settings",
    keywords: ["workspace", "business", "profile", "configure"],
  },
];

const quickActions: CommandItem[] = [
  {
    id: "ai-summary",
    title: "Summarize pipeline",
    description: "Ask Vireqo AI for a current pipeline summary.",
    icon: Activity,
    intent: "ai",
    prompt: "Summarize my pipeline and tell me the most important next action.",
    keywords: ["summary", "pipeline", "executive", "insights", "analytics"],
  },
  {
    id: "ai-hot-leads",
    title: "Show hot leads",
    description: "Find high-intent leads that need attention.",
    icon: Flame,
    intent: "ai",
    prompt: "Show my hot leads and rank who I should contact first.",
    keywords: ["hot", "leads", "urgent", "follow up", "qualified"],
  },
  {
    id: "prefill-create-lead",
    title: "Create lead",
    description: "Start an AI command to add a new opportunity.",
    icon: Plus,
    intent: "prefill",
    template: "Create a lead for ",
    keywords: ["add", "new", "contact", "opportunity", "create"],
  },
  {
    id: "prefill-schedule",
    title: "Schedule meeting",
    description: "Start an AI command to book a call or follow-up.",
    icon: CalendarDays,
    intent: "prefill",
    template: "Schedule a meeting with ",
    keywords: ["appointment", "calendar", "call", "meeting", "book"],
  },
  {
    id: "prefill-status",
    title: "Update lead status",
    description: "Ask AI to move a lead to qualified, won or lost.",
    icon: CheckCircle2,
    intent: "prefill",
    template: "Mark ",
    keywords: ["mark", "move", "status", "qualified", "won", "lost"],
  },
  {
    id: "ai-draft-followup",
    title: "Draft follow-up",
    description: "Generate a professional follow-up message for the last discussed lead.",
    icon: FileText,
    intent: "ai",
    prompt: "Draft a concise professional follow-up message for the last lead we discussed.",
    keywords: ["email", "whatsapp", "reply", "draft", "follow-up", "message"],
  },
];

function getSessionId(): string {
  if (typeof window === "undefined") return `command-${crypto.randomUUID()}`;
  const stored = window.localStorage.getItem(COMMAND_SESSION_KEY);
  if (stored) return stored;
  const created = `command-${crypto.randomUUID()}`;
  window.localStorage.setItem(COMMAND_SESSION_KEY, created);
  return created;
}

function loadRecentCommands(): RecentCommand[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_COMMANDS_KEY) ?? "[]") as RecentCommand[];
  } catch {
    return [];
  }
}

function saveRecentCommands(commands: RecentCommand[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(commands.slice(0, 6)));
}

function looksLikeAiCommand(query: string): boolean {
  return /\b(create|schedule|book|mark|move|show|summarize|draft|write|follow|find|list|qualify|update)\b/i.test(query);
}

function actionHref(response: ChatResponse): string {
  if (response.action_type?.includes("appointment")) return "/dashboard/appointments";
  if (response.action_type?.includes("lead") || response.lead_id || response.action_entity_id) {
    return "/dashboard/opportunities";
  }
  return "/dashboard/ai-assistant";
}

export function CommandCenter({ open, onClose, canViewActivity, workspaceName }: CommandCenterProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [error, setError] = useState("");
  const [recents, setRecents] = useState<RecentCommand[]>([]);

  const commands = useMemo(() => {
    const activity: CommandItem[] = canViewActivity
      ? [
          {
            id: "nav-activity",
            title: "Open activity log",
            description: "Review security, AI and CRM actions.",
            icon: ClipboardList,
            intent: "navigate",
            href: "/dashboard/activity",
            keywords: ["audit", "events", "log", "history", "security"],
          },
        ]
      : [];
    return [...quickActions, ...baseNavigation, ...activity];
  }, [canViewActivity]);

  const cleanQuery = query.trim();

  const filteredCommands = useMemo(() => {
    const lower = cleanQuery.toLowerCase();
    const matched = !lower
      ? commands
      : commands.filter((item) => {
          const haystack = [item.title, item.description, ...item.keywords].join(" ").toLowerCase();
          return haystack.includes(lower);
        });

    const askAi: CommandItem | null = cleanQuery.length >= 3
      ? {
          id: "ask-ai",
          title: looksLikeAiCommand(cleanQuery) ? "Run as AI command" : "Ask Vireqo AI",
          description: cleanQuery,
          icon: Sparkles,
          intent: "ai",
          prompt: cleanQuery,
          keywords: ["ask", "ai", "command"],
        }
      : null;

    if (!askAi) return matched;
    return looksLikeAiCommand(cleanQuery) ? [askAi, ...matched] : [...matched, askAi];
  }, [cleanQuery, commands]);

  useEffect(() => {
    if (!open) return;
    setRecents(loadRecentCommands());
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
    setResult(null);
    setError("");
  }, [query]);

  function remember(title: string, description: string) {
    const next = [
      {
        id: crypto.randomUUID(),
        title,
        description,
        createdAt: new Date().toISOString(),
      },
      ...recents.filter((item) => item.title !== title),
    ].slice(0, 6);
    setRecents(next);
    saveRecentCommands(next);
  }

  function close() {
    setQuery("");
    setSelectedIndex(0);
    setResult(null);
    setError("");
    onClose();
  }

  async function runAi(prompt: string, title = "AI command") {
    const clean = prompt.trim();
    if (!clean || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await sendWorkspaceChat({
        session_id: getSessionId(),
        message: clean,
      });
      setResult(response);
      remember(title, clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vireqo could not complete that command.");
    } finally {
      setLoading(false);
    }
  }

  function execute(command: CommandItem) {
    if (command.intent === "navigate" && command.href) {
      remember(command.title, command.description);
      router.push(command.href);
      close();
      return;
    }

    if (command.intent === "prefill" && command.template) {
      setQuery(command.template);
      window.setTimeout(() => inputRef.current?.focus(), 20);
      return;
    }

    if (command.intent === "ai" && command.prompt) {
      void runAi(command.prompt, command.title);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0)));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        execute(selected);
      } else if (cleanQuery) {
        void runAi(cleanQuery, "Ask Vireqo AI");
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) close();
  }

  async function copyResult() {
    if (!result?.reply || typeof navigator === "undefined") return;
    await navigator.clipboard?.writeText(result.reply);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="command-center-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={handleBackdrop}
        >
          <motion.section
            className="command-center"
            initial={{ opacity: 0, y: -18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Vireqo command center"
          >
            <div className="command-center-head">
              <div>
                <span><Command size={13} /> Command Center</span>
                <strong>{workspaceName}</strong>
              </div>
              <button type="button" onClick={close} aria-label="Close command center">
                <X size={16} />
              </button>
            </div>

            <div className="command-center-input">
              <Search size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages or ask Vireqo AI…"
                aria-label="Search pages or ask Vireqo AI"
              />
              <kbd>Enter</kbd>
            </div>

            <div className="command-center-body">
              <div className="command-center-results">
                {!cleanQuery && (
                  <div className="command-center-empty-state">
                    <Sparkles size={18} />
                    <div>
                      <strong>What would you like Vireqo to do?</strong>
                      <span>Navigate, create leads, schedule meetings or ask AI from one place.</span>
                    </div>
                  </div>
                )}

                {filteredCommands.map((item, index) => {
                  const Icon = item.icon;
                  const selected = index === selectedIndex;
                  return (
                    <button
                      type="button"
                      key={`${item.id}-${item.prompt ?? item.href ?? item.template ?? ""}`}
                      className={`command-center-item ${selected ? "selected" : ""}`}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => execute(item)}
                    >
                      <span><Icon size={17} /></span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </div>
                      <ArrowRight size={15} />
                    </button>
                  );
                })}

                {filteredCommands.length === 0 && (
                  <button
                    type="button"
                    className="command-center-item selected"
                    onClick={() => void runAi(cleanQuery, "Ask Vireqo AI")}
                  >
                    <span><Sparkles size={17} /></span>
                    <div>
                      <strong>Ask Vireqo AI</strong>
                      <small>{cleanQuery}</small>
                    </div>
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>

              <aside className="command-center-side">
                {loading && (
                  <div className="command-center-status">
                    <LoaderCircle className="spin" size={18} />
                    <strong>Running command</strong>
                    <span>Vireqo is checking your workspace and applying safe CRM actions.</span>
                  </div>
                )}

                {error && (
                  <div className="command-center-error">
                    <strong>Command failed</strong>
                    <span>{error}</span>
                  </div>
                )}

                {result && (
                  <div className="command-center-result">
                    <div className="command-center-result-head">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>{result.action_label ?? "AI response ready"}</strong>
                        <span>{result.memory_label ? `Remembering: ${result.memory_label}` : "Workspace command completed"}</span>
                      </div>
                    </div>
                    <p>{result.reply}</p>
                    <div className="command-center-result-actions">
                      <button type="button" onClick={copyResult}><Copy size={14} /> Copy</button>
                      <button type="button" onClick={() => { router.push(actionHref(result)); close(); }}>
                        Open related page
                      </button>
                    </div>
                  </div>
                )}

                {!loading && !result && !error && (
                  <div className="command-center-hint-card">
                    <Bot size={18} />
                    <strong>Try a natural command</strong>
                    <span>Create a lead for Rahul, show hot leads, or schedule Maya tomorrow at 3 PM.</span>
                  </div>
                )}

                {recents.length > 0 && (
                  <div className="command-center-recents">
                    <span>Recent</span>
                    {recents.slice(0, 4).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setQuery(item.description)}
                      >
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </button>
                    ))}
                  </div>
                )}
              </aside>
            </div>

            <div className="command-center-footer">
              <span>↑ ↓ to navigate</span>
              <span>Enter to run</span>
              <span>Esc to close</span>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
