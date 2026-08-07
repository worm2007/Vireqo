"use client";

import { formatHistoryTime, loadCommandHistory } from "@/lib/commandHistory";
import type { CommandHistoryEntry } from "@/lib/types";
import { Bot, Clock3, Copy, FileText, Mic, Navigation, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

type AIHistoryPanelProps = {
  version: number;
  onUseCommand: (command: string) => void;
};

function iconFor(entry: CommandHistoryEntry) {
  if (entry.kind === "draft") return <FileText size={16} />;
  if (entry.kind === "voice") return <Mic size={16} />;
  if (entry.kind === "navigation") return <Navigation size={16} />;
  return <Bot size={16} />;
}

export function AIHistoryPanel({ version, onUseCommand }: AIHistoryPanelProps) {
  const [entries, setEntries] = useState<CommandHistoryEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(loadCommandHistory());
    refresh();
    window.addEventListener("vireqo-command-history-updated", refresh);
    return () => window.removeEventListener("vireqo-command-history-updated", refresh);
  }, [version]);

  async function copy(entry: CommandHistoryEntry) {
    const value = entry.preview || entry.description;
    await navigator.clipboard?.writeText(value);
  }

  if (entries.length === 0) {
    return (
      <div className="command-history-empty">
        <Clock3 size={22} />
        <strong>No AI history yet</strong>
        <span>Run commands, create drafts or use voice. Vireqo will show your recent AI work here.</span>
      </div>
    );
  }

  return (
    <div className="command-history-panel">
      <div className="command-history-head">
        <div>
          <span>AI History</span>
          <strong>{entries.length} recent workspace actions</strong>
        </div>
      </div>

      <div className="command-history-list">
        {entries.map((entry) => (
          <article className="command-history-card" key={entry.id}>
            <span className={`command-history-icon ${entry.kind}`}>{iconFor(entry)}</span>
            <div>
              <div className="command-history-card-head">
                <strong>{entry.title}</strong>
                <small>{formatHistoryTime(entry.createdAt)}</small>
              </div>
              <p>{entry.description}</p>
              {entry.preview && <blockquote>{entry.preview}</blockquote>}
              <div className="command-history-actions">
                <button type="button" onClick={() => onUseCommand(entry.description)}>
                  <RotateCcw size={13} /> Reuse
                </button>
                <button type="button" onClick={() => void copy(entry)}>
                  <Copy size={13} /> Copy
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
