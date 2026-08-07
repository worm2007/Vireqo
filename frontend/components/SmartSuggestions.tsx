"use client";

import { CalendarDays, FileText, Flame, Plus, Sparkles } from "lucide-react";

export type SmartSuggestion = {
  id: string;
  label: string;
  prompt: string;
  kind: "command" | "draft";
};

type SmartSuggestionsProps = {
  query: string;
  onSelect: (suggestion: SmartSuggestion) => void;
};

const defaultSuggestions: SmartSuggestion[] = [
  {
    id: "default-create-lead",
    label: "Create lead",
    prompt: "Create a lead for ",
    kind: "command",
  },
  {
    id: "default-schedule",
    label: "Schedule meeting",
    prompt: "Schedule a meeting with ",
    kind: "command",
  },
  {
    id: "default-draft",
    label: "Draft follow-up",
    prompt: "Draft a concise follow-up email for ",
    kind: "draft",
  },
  {
    id: "default-hot-leads",
    label: "Hot leads",
    prompt: "Show my hot leads and rank who I should contact first.",
    kind: "command",
  },
];

function suggestionsFor(query: string): SmartSuggestion[] {
  const value = query.trim().toLowerCase();
  if (!value) return defaultSuggestions;

  if (/^(cre|add|new|lead)/.test(value)) {
    return [
      { id: "create-lead", label: "Create lead", prompt: "Create a lead for ", kind: "command" },
      { id: "create-qualified", label: "Create qualified lead", prompt: "Create a qualified lead for ", kind: "command" },
      { id: "create-hot", label: "Create hot lead", prompt: "Create a hot lead for ", kind: "command" },
    ];
  }

  if (/^(sch|book|meet|call|appoint)/.test(value)) {
    return [
      { id: "schedule-meeting", label: "Schedule meeting", prompt: "Schedule a meeting with ", kind: "command" },
      { id: "schedule-tomorrow", label: "Meeting tomorrow", prompt: "Schedule a meeting with  tomorrow at ", kind: "command" },
      { id: "confirm-meeting", label: "Draft confirmation", prompt: "Draft a meeting confirmation for ", kind: "draft" },
    ];
  }

  if (/^(dra|wri|mail|email|whats|reply|follow)/.test(value)) {
    return [
      { id: "draft-email", label: "Follow-up email", prompt: "Draft a professional follow-up email for ", kind: "draft" },
      { id: "draft-whatsapp", label: "WhatsApp follow-up", prompt: "Draft a short WhatsApp follow-up for ", kind: "draft" },
      { id: "draft-proposal", label: "Proposal intro", prompt: "Draft a proposal introduction for ", kind: "draft" },
    ];
  }

  if (/^(hot|pipe|summary|score|insight|report)/.test(value)) {
    return [
      { id: "show-hot", label: "Show hot leads", prompt: "Show my hot leads and rank who I should contact first.", kind: "command" },
      { id: "pipeline-summary", label: "Pipeline summary", prompt: "Summarize my pipeline and tell me the most important next action.", kind: "command" },
      { id: "weekly-report", label: "Weekly report", prompt: "Create a concise weekly pipeline report from my CRM data.", kind: "command" },
    ];
  }

  return [
    { id: "run-ai", label: "Run as AI command", prompt: query, kind: "command" },
    { id: "draft-from-query", label: "Turn into draft", prompt: query, kind: "draft" },
  ];
}

function IconFor({ kind, label }: { kind: SmartSuggestion["kind"]; label: string }) {
  if (kind === "draft") return <FileText size={13} />;
  if (label.toLowerCase().includes("lead")) return <Plus size={13} />;
  if (label.toLowerCase().includes("meeting")) return <CalendarDays size={13} />;
  if (label.toLowerCase().includes("hot")) return <Flame size={13} />;
  return <Sparkles size={13} />;
}

export function SmartSuggestions({ query, onSelect }: SmartSuggestionsProps) {
  const suggestions = suggestionsFor(query).slice(0, 4);

  return (
    <div className="command-smart-suggestions" aria-label="Smart suggestions">
      <span>Suggestions</span>
      {suggestions.map((suggestion) => (
        <button type="button" key={suggestion.id} onClick={() => onSelect(suggestion)}>
          <IconFor kind={suggestion.kind} label={suggestion.label} />
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
