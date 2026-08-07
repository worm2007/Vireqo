import type { CommandHistoryEntry } from "./types";

export const COMMAND_HISTORY_KEY = "vireqo-command-center-history";
const MAX_HISTORY = 24;

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function loadCommandHistory(): CommandHistoryEntry[] {
  const raw = storage()?.getItem(COMMAND_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CommandHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCommandHistory(entries: CommandHistoryEntry[]): void {
  storage()?.setItem(COMMAND_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function pushCommandHistory(entry: Omit<CommandHistoryEntry, "id" | "createdAt">): CommandHistoryEntry[] {
  const next = [
    {
      ...entry,
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
    ...loadCommandHistory(),
  ].slice(0, MAX_HISTORY);
  saveCommandHistory(next);
  window.dispatchEvent(new CustomEvent("vireqo-command-history-updated"));
  return next;
}

export function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} hr ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
