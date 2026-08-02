"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { deleteConversation, getConversations } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Copy,
  ExternalLink,
  Eye,
  LoaderCircle,
  MessageSquareText,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function ConversationsPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Conversation | null>(null);

  useEffect(() => {
    getConversations()
      .then(setItems)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load conversations"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected]);

  const filteredItems = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return items;

    return items.filter((conversation) =>
      [
        conversation.summary,
        conversation.session_id,
        ...conversation.messages.map((message) => message.content),
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(clean)),
    );
  }, [items, query]);

  async function remove(id: string) {
    if (!window.confirm("Delete this conversation permanently?")) return;

    setError("");
    setSuccess("");

    try {
      await deleteConversation(id);
      setItems((current) => current.filter((item) => item.id !== id));
      if (selected?.id === id) setSelected(null);
      setSuccess("Conversation deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete conversation");
    }
  }

  async function copyTranscript(conversation: Conversation) {
    const transcript = conversation.messages
      .map((message) => `${message.role === "assistant" ? "Vireqo" : "Visitor"}: ${message.content}`)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(transcript);
      setSuccess("Conversation copied to clipboard.");
    } catch {
      setError("The browser could not copy this conversation.");
    }
  }

  return (
    <DashboardShell>
      <div className="module-heading">
        <div>
          <span className="dashboard-eyebrow"><i /> AI concierge</span>
          <h1>Conversations</h1>
          <p>Open every visitor exchange and review the complete transcript.</p>
        </div>
      </div>

      {error && <div className="dashboard-alert">{error}</div>}
      {success && <div className="dashboard-success">{success}</div>}

      <div className="module-toolbar">
        <label className="module-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversation content"
          />
        </label>
      </div>

      {loading ? (
        <div className="module-loading">
          <LoaderCircle className="spin" />
          Loading conversations
        </div>
      ) : (
        <div className="conversation-grid">
          {filteredItems.map((conversation) => {
            const latest = conversation.messages.at(-1);
            return (
              <article className="module-card conversation-card" key={conversation.id}>
                <div className="conversation-icon">
                  <MessageSquareText size={18} />
                </div>

                <div>
                  <span className="conversation-kind">
                    {conversation.lead_id ? "Linked opportunity" : "Anonymous visitor"}
                  </span>
                  <h3>
                    {conversation.summary ||
                      (conversation.lead_id
                        ? "Qualified visitor conversation"
                        : "Visitor conversation")}
                  </h3>
                  <p>{latest?.content || "No messages"}</p>
                  <small>
                    {conversation.messages.length} messages · {new Date(conversation.updated_at).toLocaleString()}
                  </small>
                </div>

                <button
                  className="button button-dashboard compact-dashboard-button"
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setSelected(conversation);
                  }}
                >
                  <Eye size={15} />
                  Open
                </button>

                <button
                  className="icon-button"
                  type="button"
                  onClick={() => void remove(conversation.id)}
                  aria-label="Delete conversation"
                >
                  <Trash2 size={16} />
                </button>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="module-empty">No conversations match this search.</div>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            className="conversation-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setSelected(null)}
          >
            <motion.section
              className="conversation-drawer"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 36 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Conversation transcript"
            >
              <header className="conversation-drawer-header">
                <div>
                  <span>Conversation transcript</span>
                  <h2>{selected.summary || "Vireqo concierge conversation"}</h2>
                  <p>
                    {selected.messages.length} messages · Updated {new Date(selected.updated_at).toLocaleString()}
                  </p>
                </div>

                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close conversation"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="conversation-drawer-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => void copyTranscript(selected)}
                >
                  <Copy size={15} />
                  Copy transcript
                </button>

                {selected.lead_id && (
                  <Link
                    className="button button-dashboard"
                    href={`/dashboard/opportunities?edit=${selected.lead_id}`}
                  >
                    <ExternalLink size={15} />
                    Open opportunity
                  </Link>
                )}
              </div>

              <div className="conversation-transcript">
                {selected.messages.map((message) => {
                  const assistant = message.role === "assistant";
                  return (
                    <article
                      className={`transcript-message ${assistant ? "assistant" : "visitor"}`}
                      key={message.id}
                    >
                      <div className="transcript-avatar">
                        {assistant ? <Bot size={16} /> : <UserRound size={16} />}
                      </div>
                      <div>
                        <div className="transcript-meta">
                          <strong>{assistant ? "Vireqo AI" : "Visitor"}</strong>
                          <span>{new Date(message.created_at).toLocaleString()}</span>
                        </div>
                        <p>{message.content}</p>
                      </div>
                    </article>
                  );
                })}

                {selected.messages.length === 0 && (
                  <div className="module-empty">This conversation has no messages.</div>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}
