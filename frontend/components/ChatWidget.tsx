"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, LoaderCircle, Sparkles, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { sendChat } from "@/lib/api";

type ChatMessage = { role: "assistant" | "user"; content: string };

export function ChatWidget({ embedded = false }: { embedded?: boolean }) {
  const sessionId = useMemo(() => `web-${crypto.randomUUID()}`, []);
  const [open, setOpen] = useState(embedded);
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState({ name: "", email: "" });
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Welcome to Vireqo. What kind of lead or growth problem would you like to solve?" },
  ]);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean || loading) return;
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setMessage("");
    setLoading(true);
    try {
      const response = await sendChat({ session_id: sessionId, message: clean, ...identity });
      setMessages((current) => [...current, { role: "assistant", content: response.reply }]);
      if (response.score) setScore(response.score);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "The local API is offline. Start FastAPI on port 8000 and send that again." }]);
    } finally {
      setLoading(false);
    }
  }

  const panel = (
    <motion.section
      className={`chat-panel ${embedded ? "chat-embedded" : ""}`}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.97 }}
      transition={{ duration: 0.3 }}
    >
      <header className="chat-header">
        <div className="chat-avatar"><Bot size={20} /></div>
        <div><strong>Vireqo concierge</strong><span><i /> Responding now</span></div>
        {!embedded && <button onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button>}
      </header>
      <div className="chat-identity">
        <input value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} placeholder="Your name" />
        <input value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} placeholder="Email (creates lead)" type="email" />
      </div>
      <div className="chat-messages">
        {messages.map((item, index) => (
          <motion.div className={`chat-message ${item.role}`} key={`${item.role}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {item.content}
          </motion.div>
        ))}
        {loading && <div className="chat-message assistant loading-message"><LoaderCircle className="spin" size={15} /> Thinking with context</div>}
      </div>
      {score !== null && <div className="chat-score"><Sparkles size={14} /> Live intent score <strong>{score}</strong></div>}
      <form className="chat-input" onSubmit={submit}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask about pricing, setup or a demo…" />
        <button aria-label="Send message"><ArrowUp size={17} /></button>
      </form>
    </motion.section>
  );

  if (embedded) return panel;
  return (
    <>
      <AnimatePresence>{open && panel}</AnimatePresence>
      {!open && <motion.button className="chat-launcher" onClick={() => setOpen(true)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}><Sparkles size={18} /> Talk to Vireqo</motion.button>}
    </>
  );
}
