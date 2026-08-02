"use client";

import { ChatWidget } from "@/components/ChatWidget";
import { DashboardShell } from "@/components/DashboardShell";
import { Bot, ShieldCheck, Sparkles } from "lucide-react";

export default function AiAssistantPage() {
  return (
    <DashboardShell>
      <div className="module-heading">
        <div>
          <span className="dashboard-eyebrow">
            <i /> Workspace intelligence
          </span>
          <h1>Chat with AI</h1>
          <p>Use your business-aware Vireqo assistant without leaving the dashboard.</p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        <section
          className="dashboard-form-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <ChatWidget
            embedded
            authenticated
            showIdentity={false}
            initialMessage="I’m your Vireqo workspace assistant. Ask me about lead qualification, follow-ups, conversion strategy, appointment handling or your sales workflow."
          />
        </section>

        <aside className="dashboard-form-card">
          <div className="settings-card-title">
            <Sparkles size={18} />
            <div>
              <h3>What to ask</h3>
              <p>Try a practical sales or CRM question.</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {[
              "How should I qualify a new real-estate lead?",
              "Write a follow-up for a warm prospect.",
              "What questions should my chatbot ask?",
              "How can I increase booked meetings?",
            ].map((prompt) => (
              <div
                key={prompt}
                style={{
                  padding: 12,
                  border: "1px solid rgba(17,17,15,.08)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.55)",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {prompt}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid rgba(17,17,15,.08)",
              color: "#70746d",
              fontSize: 11,
              lineHeight: 1.55,
            }}
          >
            <ShieldCheck size={16} style={{ flex: "0 0 auto" }} />
            Messages are stored in your current business workspace and remain separated from other accounts.
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
