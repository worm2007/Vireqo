"use client";

import type { Lead, LeadDetail } from "@/lib/types";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Pencil,
  Phone,
  RefreshCcw,
  Sparkles,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

const stageOptions: Array<{ status: Lead["status"]; label: string }> = [
  { status: "new", label: "New" },
  { status: "contacted", label: "Contacted" },
  { status: "qualified", label: "Qualified" },
  { status: "won", label: "Won" },
  { status: "lost", label: "Lost" },
];

type DealDetailDrawerProps = {
  open: boolean;
  detail: LeadDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onRefresh: () => void;
  onStatusChange: (lead: Lead, nextStatus: Lead["status"]) => void | Promise<void>;
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getContactLine(lead: Lead) {
  return lead.company || lead.email || lead.phone || "No contact detail yet";
}

function getTimelineIcon(type: string) {
  if (type === "appointment") return CalendarClock;
  if (type === "conversation") return MessageSquareText;
  if (type === "audit") return History;
  return Activity;
}

export function DealDetailDrawer({
  open,
  detail,
  loading,
  error,
  onClose,
  onEdit,
  onRefresh,
  onStatusChange,
}: DealDetailDrawerProps) {
  const lead = detail?.lead ?? null;
  const prediction = detail?.prediction ?? null;

  if (!open) return null;

  return (
    <div className="deal-drawer-layer" role="dialog" aria-modal="true" aria-label="Deal detail drawer">
      <button className="deal-drawer-scrim" type="button" onClick={onClose} aria-label="Close deal detail" />

      <aside className="deal-drawer-panel">
        <div className="deal-drawer-header">
          <div>
            <span className="dashboard-eyebrow">
              <i /> Deal detail
            </span>
            <h2>{lead?.name ?? "Loading opportunity"}</h2>
            <p>{lead ? getContactLine(lead) : "Building the timeline and intelligence view."}</p>
          </div>

          <div className="deal-drawer-actions">
            <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh deal detail">
              <RefreshCcw size={16} />
            </button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close drawer">
              <X size={17} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="deal-drawer-loading">
            <LoaderCircle className="spin" size={22} />
            Loading deal intelligence
          </div>
        )}

        {error && !loading && <div className="dashboard-alert">{error}</div>}

        {lead && detail && !loading && (
          <div className="deal-drawer-content">
            <section className="deal-hero-card">
              <div className="deal-hero-main">
                <span className={`temperature ${prediction?.temperature ?? lead.temperature}`}>
                  <i />
                  {prediction?.temperature ?? lead.temperature}
                </span>
                <h3>{prediction?.conversion_label ?? "Pipeline opportunity"}</h3>
                <p>{detail.summary.next_action}</p>
              </div>

              <div className="deal-hero-score">
                <strong>{prediction?.score ?? lead.score}</strong>
                <span>lead score</span>
                <em>{prediction ? `${prediction.conversion_probability}% close chance` : "predicting"}</em>
              </div>
            </section>

            <section className="deal-drawer-grid">
              <div className="deal-signal-card">
                <BrainCircuit size={18} />
                <span>Relationship</span>
                <strong>{detail.summary.relationship_health}</strong>
              </div>
              <div className={`deal-signal-card risk-${detail.summary.risk_level}`}>
                <AlertTriangle size={18} />
                <span>Risk</span>
                <strong>{detail.summary.risk_reason}</strong>
              </div>
              <div className="deal-signal-card">
                <CalendarClock size={18} />
                <span>Next meeting</span>
                <strong>{formatDate(detail.summary.upcoming_meeting_at)}</strong>
              </div>
              <div className="deal-signal-card">
                <Clock3 size={18} />
                <span>Latest touch</span>
                <strong>{formatDate(detail.summary.latest_touch_at)}</strong>
              </div>
            </section>

            <section className="deal-contact-card">
              <div className="deal-section-title">
                <UserRound size={18} />
                <div>
                  <h3>Contact and qualification</h3>
                  <p>Everything important about this opportunity in one place.</p>
                </div>
              </div>

              <div className="deal-contact-grid">
                <div>
                  <Building2 size={16} />
                  <span>{lead.company || "Company not added"}</span>
                </div>
                <div>
                  <Mail size={16} />
                  <span>{lead.email || "Email not added"}</span>
                </div>
                <div>
                  <Phone size={16} />
                  <span>{lead.phone || "Phone not added"}</span>
                </div>
                <div>
                  <WalletCards size={16} />
                  <span>{lead.budget || "Budget not added"}</span>
                </div>
              </div>

              <div className="deal-notes-block">
                <span>Need</span>
                <p>{lead.need || "No qualification note yet."}</p>
              </div>
              <div className="deal-notes-block">
                <span>Internal notes</span>
                <p>{lead.notes || "No internal notes yet."}</p>
              </div>
            </section>

            <section className="deal-stage-card">
              <div className="deal-section-title">
                <Sparkles size={18} />
                <div>
                  <h3>Move deal</h3>
                  <p>Update the stage from the detail view without leaving the board.</p>
                </div>
              </div>

              <div className="deal-stage-buttons">
                {stageOptions.map((stage) => (
                  <button
                    className={stage.status === lead.status ? "active" : ""}
                    disabled={stage.status === lead.status}
                    key={stage.status}
                    onClick={() => void onStatusChange(lead, stage.status)}
                    type="button"
                  >
                    {stage.status === lead.status ? <CheckCircle2 size={14} /> : null}
                    {stage.label}
                  </button>
                ))}
              </div>
            </section>

            {prediction && (
              <section className="deal-ai-card">
                <div className="deal-section-title">
                  <BrainCircuit size={18} />
                  <div>
                    <h3>AI reasoning</h3>
                    <p>{prediction.next_action}</p>
                  </div>
                </div>

                <div className="deal-ai-tags">
                  {prediction.reasons.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                  {prediction.risks.map((risk) => (
                    <span className="risk" key={risk}>{risk}</span>
                  ))}
                </div>
              </section>
            )}

            <section className="deal-timeline-card">
              <div className="deal-section-title">
                <History size={18} />
                <div>
                  <h3>Activity timeline</h3>
                  <p>
                    {detail.summary.activity_count} events · {detail.summary.appointment_count} meetings · {detail.summary.conversation_count} conversations
                  </p>
                </div>
              </div>

              <div className="deal-timeline-list">
                {detail.timeline.map((item) => {
                  const Icon = getTimelineIcon(item.type);
                  return (
                    <article className={`deal-timeline-item tone-${item.tone}`} key={item.id}>
                      <div className="deal-timeline-icon">
                        <Icon size={15} />
                      </div>
                      <div>
                        <div className="deal-timeline-row">
                          <strong>{item.title}</strong>
                          <time>{formatFullDate(item.timestamp)}</time>
                        </div>
                        <p>{item.description}</p>
                      </div>
                    </article>
                  );
                })}

                {detail.timeline.length === 0 && (
                  <div className="module-empty">No activity has been recorded for this deal yet.</div>
                )}
              </div>
            </section>

            <div className="deal-drawer-footer">
              <button className="button button-dashboard" type="button" onClick={() => onEdit(lead)}>
                <Pencil size={15} />
                Edit full details
              </button>
              <button className="button" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
