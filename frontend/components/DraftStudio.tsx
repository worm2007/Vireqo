"use client";

import { generateWorkspaceDraft } from "@/lib/api";
import { pushCommandHistory } from "@/lib/commandHistory";
import type { WorkspaceDraftResponse } from "@/lib/types";
import { CheckCircle2, Copy, FileText, LoaderCircle, Mail, MessageSquareText, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type DraftStudioProps = {
  initialPrompt?: string;
  onHistoryChange: () => void;
};

type DraftType = {
  id: string;
  label: string;
  description: string;
};

const draftTypes: DraftType[] = [
  { id: "follow_up_email", label: "Follow-up email", description: "Professional email after a demo, enquiry or call." },
  { id: "whatsapp_follow_up", label: "WhatsApp follow-up", description: "Short message for fast client follow-up." },
  { id: "proposal_intro", label: "Proposal intro", description: "Opening message for a proposal or quote." },
  { id: "meeting_confirmation", label: "Meeting confirmation", description: "Confirm time, agenda and next step." },
  { id: "cold_outreach", label: "Cold outreach", description: "Start a new business conversation." },
  { id: "client_reply", label: "Client reply", description: "Reply to an existing client message." },
];

const toneOptions = ["professional", "warm", "direct", "premium", "friendly"];

export function DraftStudio({ initialPrompt = "", onHistoryChange }: DraftStudioProps) {
  const [draftType, setDraftType] = useState("follow_up_email");
  const [recipient, setRecipient] = useState("");
  const [context, setContext] = useState(initialPrompt);
  const [goal, setGoal] = useState("Book the next conversation with a clear next step.");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WorkspaceDraftResponse | null>(null);
  const selectedDraft = useMemo(
    () => draftTypes.find((item) => item.id === draftType) ?? draftTypes[0],
    [draftType],
  );

  async function generateDraft() {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await generateWorkspaceDraft({
        draft_type: draftType,
        recipient,
        context,
        goal,
        tone,
      });
      setResult(response);
      pushCommandHistory({
        title: selectedDraft.label,
        description: [recipient, goal].filter(Boolean).join(" · ") || selectedDraft.description,
        kind: "draft",
        status: "completed",
        preview: response.draft.slice(0, 220),
      });
      onHistoryChange();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Vireqo could not create this draft.";
      setError(message);
      pushCommandHistory({
        title: `${selectedDraft.label} failed`,
        description: message,
        kind: "draft",
        status: "failed",
      });
      onHistoryChange();
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    if (!result) return;
    const value = result.subject ? `Subject: ${result.subject}\n\n${result.draft}` : result.draft;
    await navigator.clipboard?.writeText(value);
  }

  return (
    <div className="draft-studio">
      <section className="draft-studio-form">
        <div className="draft-studio-title">
          <Sparkles size={18} />
          <div>
            <span>Draft Studio</span>
            <strong>Generate polished client messages from CRM context.</strong>
          </div>
        </div>

        <div className="draft-type-grid">
          {draftTypes.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === draftType ? "active" : ""}
              onClick={() => setDraftType(item.id)}
            >
              {item.id.includes("whatsapp") ? <MessageSquareText size={15} /> : <Mail size={15} />}
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        <label>
          Recipient or lead
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Rahul Sharma from Apex Realty"
          />
        </label>

        <label>
          Context
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="They asked for pricing after yesterday's demo and want implementation this month."
            rows={4}
          />
        </label>

        <label>
          Goal
          <input
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Book a 15-minute follow-up call tomorrow."
          />
        </label>

        <div className="draft-tone-row">
          {toneOptions.map((item) => (
            <button
              type="button"
              key={item}
              className={tone === item ? "active" : ""}
              onClick={() => setTone(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <button type="button" className="draft-generate-button" onClick={() => void generateDraft()} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
          {loading ? "Writing draft" : "Generate draft"}
        </button>
      </section>

      <aside className="draft-studio-preview">
        {!result && !error && !loading && (
          <div className="draft-preview-empty">
            <FileText size={24} />
            <strong>{selectedDraft.label}</strong>
            <span>Fill the context and Vireqo will generate a ready-to-copy message.</span>
          </div>
        )}

        {loading && (
          <div className="draft-preview-empty">
            <LoaderCircle className="spin" size={24} />
            <strong>Writing with workspace context</strong>
            <span>Vireqo is preparing a concise draft for your CRM workflow.</span>
          </div>
        )}

        {error && (
          <div className="draft-error">
            <strong>Draft failed</strong>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="draft-result-card">
            <div className="draft-result-head">
              <CheckCircle2 size={18} />
              <div>
                <strong>Draft ready</strong>
                <span>{selectedDraft.label}</span>
              </div>
            </div>
            {result.subject && (
              <div className="draft-subject">
                <span>Subject</span>
                <strong>{result.subject}</strong>
              </div>
            )}
            <p>{result.draft}</p>
            {result.suggestions.length > 0 && (
              <ul>
                {result.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => void copyDraft()}>
              <Copy size={14} /> Copy draft
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
