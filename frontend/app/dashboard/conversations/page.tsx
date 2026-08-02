"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { deleteConversation, getConversations } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { LoaderCircle, MessageSquareText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function ConversationsPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getConversations().then(setItems).catch((err) => setError(err instanceof Error ? err.message : "Unable to load conversations")).finally(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    if (!window.confirm("Delete this conversation? The linked lead will remain.")) return;
    try {
      await deleteConversation(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete conversation");
    }
  }

  return <DashboardShell><div className="module-heading"><div><span className="dashboard-eyebrow"><i /> AI concierge</span><h1>Conversations</h1><p>Every visitor exchange stored with its linked opportunity.</p></div></div>{error && <div className="dashboard-alert">{error}</div>}{loading ? <div className="module-loading"><LoaderCircle className="spin" /> Loading conversations</div> : <div className="conversation-grid">{items.map((conversation) => { const latest = conversation.messages.at(-1); return <article className="module-card conversation-card" key={conversation.id}><div className="conversation-icon"><MessageSquareText size={18} /></div><div><h3>{conversation.lead_id ? "Qualified visitor conversation" : "Anonymous visitor conversation"}</h3><p>{latest?.content || "No messages"}</p><small>{conversation.messages.length} messages · {new Date(conversation.updated_at).toLocaleString()}</small></div><button className="icon-button" onClick={() => void remove(conversation.id)} aria-label="Delete conversation"><Trash2 size={16} /></button></article>; })}</div>}{!loading && items.length === 0 && <div className="module-empty">No chatbot conversations yet.</div>}</DashboardShell>;
}
