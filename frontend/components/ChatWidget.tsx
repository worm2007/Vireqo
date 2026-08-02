"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, LoaderCircle, Sparkles, X } from "lucide-react";
import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getStoredUser, sendChat, sendWorkspaceChat } from "@/lib/api";
import {
  VIREQO_CHAT_EVENT,
  type VireqoChatEventDetail,
} from "@/lib/uiEvents";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type ChatWidgetProps = {
  embedded?: boolean;
  businessSlug?: string;
  showIdentity?: boolean;
  initialMessage?: string;
  authenticated?: boolean;
};

export function ChatWidget({
  embedded = false,
  businessSlug,
  showIdentity = true,
  initialMessage =
    "Welcome to Vireqo. What kind of lead or growth problem would you like to solve?",
  authenticated = false,
}: ChatWidgetProps) {
  const sessionId = useMemo(() => `web-${crypto.randomUUID()}`, []);
  const resolvedBusinessSlug =
    businessSlug ?? getStoredUser()?.business.slug ?? "vireqo-demo";

  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(embedded);
  const [launcherHovered, setLauncherHovered] = useState(false);
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState({ name: "", email: "" });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: initialMessage,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth <= 760);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const clean = rawMessage.trim();
      if (!clean || loading) return;

      setMessages((current) => [
        ...current,
        { role: "user", content: clean },
      ]);
      setMessage("");
      setLoading(true);

      try {
        const response = authenticated
          ? await sendWorkspaceChat({
              session_id: sessionId,
              message: clean,
            })
          : await sendChat(
              {
                session_id: sessionId,
                message: clean,
                ...(showIdentity ? identity : {}),
              },
              resolvedBusinessSlug,
            );

        setMessages((current) => [
          ...current,
          { role: "assistant", content: response.reply },
        ]);

        if (response.score !== null && response.score !== undefined) {
          setScore(response.score);
        }
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              error instanceof Error
                ? error.message
                : "Vireqo could not complete that request. Please try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      authenticated,
      identity,
      loading,
      resolvedBusinessSlug,
      sessionId,
      showIdentity,
    ],
  );

  useEffect(() => {
    const handleChatRequest = (event: Event) => {
      const detail = (event as CustomEvent<VireqoChatEventDetail>).detail ?? {};

      if (!embedded) {
        setOpen(true);
      }

      if (detail.message) {
        setMessage(detail.message);
        if (detail.submit) {
          void sendMessage(detail.message);
        }
      }

      window.setTimeout(() => inputRef.current?.focus(), 80);
    };

    window.addEventListener(VIREQO_CHAT_EVENT, handleChatRequest);
    return () => window.removeEventListener(VIREQO_CHAT_EVENT, handleChatRequest);
  }, [embedded, sendMessage]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(message);
  }

  const panelPosition: CSSProperties = embedded
    ? {}
    : isMobile
      ? {
          position: "fixed",
          left: 10,
          right: 10,
          top: 10,
          bottom: 10,
          width: "auto",
          height: "auto",
          zIndex: 90,
        }
      : {
          position: "fixed",
          left: 22,
          right: "auto",
          top: "50%",
          bottom: "auto",
          translate: "0 -50%",
          width: "min(390px, calc(100vw - 44px))",
          height: "min(625px, calc(100vh - 48px))",
          zIndex: 90,
        };

  const panel = (
    <motion.section
      className={`chat-panel ${embedded ? "chat-embedded" : ""}`}
      style={panelPosition}
      initial={
        embedded
          ? false
          : {
              opacity: 0,
              x: -22,
              scale: 0.98,
            }
      }
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -22, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="chat-header">
        <div className="chat-avatar">
          <Bot size={20} />
        </div>

        <div>
          <strong>Vireqo concierge</strong>
          <span>
            <i /> Responding now
          </span>
        </div>

        {!embedded && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        )}
      </header>

      {showIdentity && (
        <div className="chat-identity">
          <input
            value={identity.name}
            onChange={(event) =>
              setIdentity({ ...identity, name: event.target.value })
            }
            placeholder="Your name"
          />

          <input
            value={identity.email}
            onChange={(event) =>
              setIdentity({ ...identity, email: event.target.value })
            }
            placeholder="Email (creates lead)"
            type="email"
          />
        </div>
      )}

      <div className="chat-messages">
        {messages.map((item, index) => (
          <motion.div
            className={`chat-message ${item.role}`}
            key={`${item.role}-${index}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {item.content}
          </motion.div>
        ))}

        {loading && (
          <div className="chat-message assistant loading-message">
            <LoaderCircle className="spin" size={15} />
            Thinking with context
          </div>
        )}
      </div>

      {score !== null && (
        <div className="chat-score">
          <Sparkles size={14} />
          Live intent score <strong>{score}</strong>
        </div>
      )}

      <form className="chat-input" onSubmit={submit}>
        <input
          ref={inputRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask about pricing, setup or a demo…"
        />

        <button type="submit" aria-label="Send message" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={17} /> : <ArrowUp size={17} />}
        </button>
      </form>
    </motion.section>
  );

  if (embedded) {
    return panel;
  }

  return (
    <>
      <AnimatePresence>{open && panel}</AnimatePresence>

      {!open && (
        <motion.button
          type="button"
          aria-label="Talk to Vireqo"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setLauncherHovered(true)}
          onMouseLeave={() => setLauncherHovered(false)}
          initial={{ opacity: 0, x: -10 }}
          animate={{
            opacity: 1,
            x: 0,
            width: isMobile ? 54 : launcherHovered ? 178 : 54,
          }}
          whileTap={{ scale: 0.97 }}
          transition={{
            width: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.2 },
            x: { duration: 0.2 },
          }}
          style={
            isMobile
              ? {
                  position: "fixed",
                  left: 12,
                  bottom: 12,
                  top: "auto",
                  right: "auto",
                  zIndex: 80,
                  height: 54,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 999,
                  background: "#11110f",
                  color: "#fff",
                  boxShadow: "0 18px 48px rgba(0,0,0,.22)",
                  cursor: "pointer",
                }
              : {
                  position: "fixed",
                  left: 0,
                  top: "62%",
                  bottom: "auto",
                  right: "auto",
                  translate: "0 -50%",
                  zIndex: 80,
                  height: 54,
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 10,
                  overflow: "hidden",
                  borderTop: "1px solid rgba(255,255,255,.12)",
                  borderRight: "1px solid rgba(255,255,255,.12)",
                  borderBottom: "1px solid rgba(255,255,255,.12)",
                  borderLeft: "0",
                  borderRadius: "0 17px 17px 0",
                  background: "#11110f",
                  color: "#fff",
                  boxShadow: "0 18px 48px rgba(0,0,0,.22)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }
          }
        >
          <Sparkles size={19} style={{ flex: "0 0 auto" }} />

          <motion.span
            animate={{
              opacity: isMobile ? 0 : launcherHovered ? 1 : 0,
              x: launcherHovered ? 0 : -8,
            }}
            transition={{ duration: 0.18 }}
            style={{
              display: isMobile ? "none" : "inline-block",
              fontSize: 15,
              fontWeight: 750,
              whiteSpace: "nowrap",
            }}
          >
            Talk to Vireqo
          </motion.span>
        </motion.button>
      )}
    </>
  );
}
