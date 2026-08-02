"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bot, Check, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const conversationSteps = [
  {
    role: "assistant",
    text: "Hi, I’m Vireqo. What kind of business are you growing?",
  },
  {
    role: "visitor",
    text: "A real estate agency with two property websites.",
  },
  {
    role: "assistant",
    text: "Perfect. How many enquiries do you receive each month?",
  },
  {
    role: "visitor",
    text: "Around 120. We lose many because replies are late.",
  },
  {
    role: "assistant",
    text: "I’ve qualified this as a high-intent opportunity and prepared the next action.",
  },
];

export function HeroConversation() {
  const reduceMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(1);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(conversationSteps.length);
      return;
    }

    let current = 1;

    const interval = window.setInterval(() => {
      setIsTyping(true);

      window.setTimeout(() => {
        current += 1;
        setVisibleCount(Math.min(current, conversationSteps.length));
        setIsTyping(false);

        if (current >= conversationSteps.length) {
          window.clearInterval(interval);
        }
      }, 800);
    }, 2100);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  return (
    <motion.div
      className="hero-conversation"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="hero-conversation-head">
        <div className="conversation-agent">
          <span className="conversation-agent-icon">
            <Bot size={16} />
          </span>
          <div>
            <strong>Vireqo Concierge</strong>
            <span><i /> Online now</span>
          </div>
        </div>

        <div className="conversation-badge">
          <Sparkles size={13} />
          Live qualification
        </div>
      </div>

      <div className="hero-conversation-body">
        <AnimatePresence initial={false}>
          {conversationSteps.slice(0, visibleCount).map((message, index) => (
            <motion.div
              key={`${message.role}-${index}`}
              className={`conversation-message ${message.role}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {message.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            className="conversation-typing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span />
            <span />
            <span />
          </motion.div>
        )}
      </div>

      <motion.div
        className="conversation-outcome"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: visibleCount === conversationSteps.length ? 1 : 0,
          y: visibleCount === conversationSteps.length ? 0 : 10,
        }}
      >
        <span><Check size={14} /> Qualified opportunity</span>
        <strong>Intent score 92</strong>
      </motion.div>
    </motion.div>
  );
}