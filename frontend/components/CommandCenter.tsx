"use client";

import { sendWorkspaceChat } from "@/lib/api";
import { pushCommandHistory } from "@/lib/commandHistory";
import type { ChatResponse, CommandHistoryEntry } from "@/lib/types";
import { AIHistoryPanel } from "./AIHistoryPanel";
import { DraftStudio } from "./DraftStudio";
import { SmartSuggestions, type SmartSuggestion } from "./SmartSuggestions";
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
  History,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareText,
  Mic,
  MicOff,
  PenLine,
  Plus,
  Radio,
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
type CommandMode = "commands" | "draft" | "history";

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

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

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

function normalizeVoiceCommand(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function spokenMatchesCommand(spoken: string, command: CommandItem): boolean {
  const normalized = normalizeVoiceCommand(spoken);
  const title = command.title.toLowerCase();
  const relaxedTitle = title
    .replace(/^open\s+/, "")
    .replace(/^show\s+/, "")
    .replace(/^summarize\s+/, "")
    .trim();

  if (normalized === title || normalized === relaxedTitle) return true;

  if (command.intent === "prefill") {
    return false;
  }

  const isNavigationPhrase = /^(open|go to|show|show me|take me to|navigate to)\b/.test(normalized);

  if (command.intent === "navigate" && !isNavigationPhrase) {
    return false;
  }

  if (normalized.includes(title) || normalized.includes(relaxedTitle)) return true;

  return command.keywords.some((keyword) => {
    const cleanKeyword = keyword.toLowerCase();
    return cleanKeyword.length > 2 && normalized.includes(cleanKeyword);
  });
}

function voiceErrorMessage(error?: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone access was blocked. Allow microphone permission in the browser and try again.";
  }

  if (error === "no-speech") {
    return "No speech was detected. Try again and speak clearly after the listening indicator appears.";
  }

  if (error === "network") {
    return "Voice recognition could not reach the browser speech service. Check your internet connection.";
  }

  return "Voice command could not be processed. Type the command or try speaking again.";
}

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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalVoiceCommandRef = useRef("");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [error, setError] = useState("");
  const [recents, setRecents] = useState<RecentCommand[]>([]);
  const [activeMode, setActiveMode] = useState<CommandMode>("commands");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [draftSeed, setDraftSeed] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");

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

  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" &&
        Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    );

    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.abort();
      setListening(false);
      setVoiceError("");
      setVoiceTranscript("");
    }
  }, [open]);

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
    if (!listening) setVoiceError("");
  }, [query, listening]);

  function remember(
    title: string,
    description: string,
    kind: CommandHistoryEntry["kind"] = "command",
    preview?: string,
  ) {
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
    pushCommandHistory({
      title,
      description,
      kind,
      status: "completed",
      preview,
    });
    setHistoryVersion((version) => version + 1);
  }

  function close() {
    recognitionRef.current?.abort();
    setListening(false);
    setVoiceTranscript("");
    setVoiceError("");
    setQuery("");
    setSelectedIndex(0);
    setResult(null);
    setError("");
    setActiveMode("commands");
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
      remember(title, clean, title === "Voice command" ? "voice" : "command", response.reply.slice(0, 220));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Vireqo could not complete that command.";
      setError(message);
      pushCommandHistory({
        title: `${title} failed`,
        description: clean,
        kind: title === "Voice command" ? "voice" : "command",
        status: "failed",
        preview: message,
      });
      setHistoryVersion((version) => version + 1);
    } finally {
      setLoading(false);
    }
  }

  function execute(command: CommandItem) {
    if (command.intent === "navigate" && command.href) {
      remember(command.title, command.description, "navigation");
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

  function executeSpokenCommand(spoken: string) {
    const clean = spoken.trim();
    if (!clean || loading) return;

    const directMatch = commands.find((command) => spokenMatchesCommand(clean, command));

    if (directMatch) {
      execute(directMatch);
      return;
    }

    void runAi(clean, "Voice command");
  }

  function startVoiceCommand() {
    if (!voiceSupported || loading || typeof window === "undefined") return;

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceSupported(false);
      setVoiceError("Voice commands are not supported in this browser. Use Chrome or type the command.");
      return;
    }

    recognitionRef.current?.abort();
    finalVoiceCommandRef.current = "";
    setVoiceError("");
    setVoiceTranscript("");

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListening(true);
      setVoiceError("");
      setVoiceTranscript("Listening...");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const speechResult = event.results[index];
        const transcript = speechResult[0]?.transcript ?? "";

        if (speechResult.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const spoken = (final || interim).trim();
      if (spoken) {
        setQuery(spoken);
        setVoiceTranscript(spoken);
      }

      if (final.trim()) {
        finalVoiceCommandRef.current = final.trim();
      }
    };

    recognition.onerror = (event) => {
      setVoiceError(voiceErrorMessage(event.error));
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      const finalCommand = finalVoiceCommandRef.current.trim();
      finalVoiceCommandRef.current = "";

      if (finalCommand.length >= 3) {
        window.setTimeout(() => executeSpokenCommand(finalCommand), 180);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopVoiceCommand() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function toggleVoiceCommand() {
    if (listening) {
      stopVoiceCommand();
    } else {
      startVoiceCommand();
    }
  }

  function handleSmartSuggestion(suggestion: SmartSuggestion) {
    if (suggestion.kind === "draft") {
      setDraftSeed(suggestion.prompt);
      setActiveMode("draft");
      return;
    }

    setQuery(suggestion.prompt);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }

  function handleHistoryChange() {
    setHistoryVersion((version) => version + 1);
  }

  function handleUseHistoryCommand(value: string) {
    setActiveMode("commands");
    setQuery(value);
    window.setTimeout(() => inputRef.current?.focus(), 20);
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

            <div className="command-center-tabs">
              <button
                type="button"
                className={activeMode === "commands" ? "active" : ""}
                onClick={() => setActiveMode("commands")}
              >
                <Command size={14} /> Commands
              </button>
              <button
                type="button"
                className={activeMode === "draft" ? "active" : ""}
                onClick={() => setActiveMode("draft")}
              >
                <PenLine size={14} /> Draft Studio
              </button>
              <button
                type="button"
                className={activeMode === "history" ? "active" : ""}
                onClick={() => setActiveMode("history")}
              >
                <History size={14} /> AI History
              </button>
            </div>

            {activeMode === "commands" && (
              <>
                <div className="command-center-input">
                  <Search size={18} />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={listening ? "Listening for a Vireqo command…" : "Search pages or ask Vireqo AI…"}
                    aria-label="Search pages or ask Vireqo AI"
                  />
                  <button
                    type="button"
                    className={`command-voice-button ${listening ? "listening" : ""}`}
                    onClick={toggleVoiceCommand}
                    disabled={!voiceSupported || loading}
                    title={
                      voiceSupported
                        ? listening
                          ? "Stop voice command"
                          : "Speak a Vireqo command"
                        : "Voice commands are not supported in this browser"
                    }
                    aria-label={listening ? "Stop voice command" : "Speak a Vireqo command"}
                  >
                    {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <kbd>Enter</kbd>
                </div>

                {(listening || voiceTranscript || voiceError) && (
                  <div className={`command-voice-strip ${voiceError ? "error" : listening ? "listening" : ""}`}>
                    <Radio size={14} />
                    <span>
                      {voiceError ||
                        (listening
                          ? `Listening: ${voiceTranscript}`
                          : `Heard: ${voiceTranscript}`)}
                    </span>
                  </div>
                )}

                <SmartSuggestions query={query} onSelect={handleSmartSuggestion} />

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
                        <span>Type or speak: create a lead for Rahul, show hot leads, or schedule Maya tomorrow at 3 PM.</span>
                      </div>
                    )}

                    {!voiceSupported && (
                      <div className="command-center-voice-note">
                        <MicOff size={15} />
                        <span>Voice commands are unavailable in this browser. Chrome usually supports them best.</span>
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
              </>
            )}

            {activeMode === "draft" && (
              <DraftStudio
                key={draftSeed}
                initialPrompt={draftSeed || query}
                onHistoryChange={handleHistoryChange}
              />
            )}

            {activeMode === "history" && (
              <AIHistoryPanel
                version={historyVersion}
                onUseCommand={handleUseHistoryCommand}
              />
            )}


            <div className="command-center-footer">
              <span>↑ ↓ to navigate</span>
              <span>Enter to run</span>
              <span>Mic to speak</span>
              <span>Esc to close</span>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
