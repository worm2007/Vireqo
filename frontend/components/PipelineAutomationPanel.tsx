"use client";

import type { Lead, PipelineAutomation } from "@/lib/types";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  GitBranch,
  LoaderCircle,
  MoveRight,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  automation: PipelineAutomation | null;
  leads?: Lead[];
  compact?: boolean;
  onOpenLead?: (lead: Lead) => void;
  onChangeStatus?: (lead: Lead, status: Lead["status"]) => Promise<void> | void;
};

const priorityLabels: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function isLeadStatus(value: string | null | undefined): value is Lead["status"] {
  return Boolean(value && ["new", "contacted", "qualified", "won", "lost"].includes(value));
}

function statusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PipelineAutomationPanel({
  automation,
  leads = [],
  compact = false,
  onOpenLead,
  onChangeStatus,
}: Props) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

  const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const visibleActions = (automation?.actions ?? []).filter((item) => !localDone.has(item.id)).slice(0, compact ? 4 : 8);
  const activeRules = (automation?.rules ?? []).filter((rule) => rule.trigger_count > 0).slice(0, compact ? 4 : 6);

  async function applySuggestedStatus(actionId: string, leadId: string, nextStatus?: string | null) {
    if (!onChangeStatus || !isLeadStatus(nextStatus)) return;
    const lead = leadMap.get(leadId);
    if (!lead) return;

    setApplyingId(actionId);
    try {
      await onChangeStatus(lead, nextStatus);
      setLocalDone((current) => new Set(current).add(actionId));
    } finally {
      setApplyingId(null);
    }
  }

  function openLead(leadId: string, href: string) {
    const lead = leadMap.get(leadId);
    if (lead && onOpenLead) {
      onOpenLead(lead);
      return;
    }
    window.location.href = href;
  }

  if (!automation) {
    return (
      <section className="pipeline-automation-card loading">
        <LoaderCircle className="spin" size={20} />
        <div>
          <strong>Loading pipeline automation</strong>
          <span>Checking stale deals, next steps and stage suggestions…</span>
        </div>
      </section>
    );
  }

  return (
    <section className={`pipeline-automation-card${compact ? " compact" : ""}`}>
      <div className="pipeline-automation-hero">
        <div className="pipeline-automation-copy">
          <span className="executive-kicker">
            <Wand2 size={14} /> Pipeline automation
          </span>
          <h2>{automation.summary.headline}</h2>
          <p>
            Vireqo is watching stage movement, stale opportunities, follow-up windows and meeting confirmations.
          </p>
        </div>

        <div className="automation-health-panel">
          <div className="automation-health-ring" style={{ "--automation-health": automation.summary.automation_health } as React.CSSProperties}>
            <strong>{automation.summary.automation_health}</strong>
            <span>/100</span>
          </div>
          <small>Automation health</small>
        </div>
      </div>

      <div className="automation-metric-grid">
        <div className={automation.summary.urgent_count ? "risk" : ""}>
          <ShieldAlert size={16} />
          <strong>{automation.summary.urgent_count}</strong>
          <span>urgent</span>
        </div>
        <div>
          <BellRing size={16} />
          <strong>{automation.summary.followups_due}</strong>
          <span>follow-ups</span>
        </div>
        <div>
          <GitBranch size={16} />
          <strong>{automation.summary.suggested_stage_moves}</strong>
          <span>stage moves</span>
        </div>
        <div>
          <TimerReset size={16} />
          <strong>{automation.summary.meetings_to_confirm}</strong>
          <span>meeting checks</span>
        </div>
      </div>

      <div className="automation-content-grid">
        <div className="automation-action-panel">
          <div className="automation-panel-heading">
            <div>
              <span>Generated actions</span>
              <h3>Next best moves</h3>
            </div>
            <em>{automation.summary.total_actions} active</em>
          </div>

          <div className="automation-action-list">
            {visibleActions.length ? visibleActions.map((action) => (
              <article className={`automation-action priority-${action.priority}`} key={action.id}>
                <div className="automation-action-topline">
                  <span>{priorityLabels[action.priority] ?? statusLabel(action.priority)}</span>
                  <em>{action.due_label}</em>
                </div>
                <h4>{action.title}</h4>
                <p>{action.description}</p>
                <div className="automation-action-meta">
                  <span>{action.rule_label}</span>
                  <span>{action.reason}</span>
                  <span>{action.estimated_impact}</span>
                </div>
                <div className="automation-action-buttons">
                  {isLeadStatus(action.suggested_status) && onChangeStatus && (
                    <button
                      className="button button-small automation-apply-button"
                      type="button"
                      onClick={() => void applySuggestedStatus(action.id, action.lead_id, action.suggested_status)}
                      disabled={applyingId === action.id}
                    >
                      {applyingId === action.id ? <LoaderCircle className="spin" size={14} /> : <MoveRight size={14} />}
                      Move to {statusLabel(action.suggested_status)}
                    </button>
                  )}
                  <button
                    className="automation-link-button"
                    type="button"
                    onClick={() => openLead(action.lead_id, action.href)}
                  >
                    {action.cta_label} <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            )) : (
              <div className="automation-empty-state">
                <CheckCircle2 size={22} />
                <strong>No automation actions right now</strong>
                <span>Your open pipeline is within the current rule windows.</span>
              </div>
            )}
          </div>
        </div>

        <div className="automation-rule-panel">
          <div className="automation-panel-heading">
            <div>
              <span>Active rules</span>
              <h3>What Vireqo is checking</h3>
            </div>
            <Sparkles size={17} />
          </div>

          <div className="automation-rule-list">
            {activeRules.length ? activeRules.map((rule) => (
              <div className={`automation-rule severity-${rule.severity}`} key={rule.id}>
                <div>
                  <strong>{rule.title}</strong>
                  <p>{rule.recommendation}</p>
                </div>
                <em>{rule.trigger_count}</em>
              </div>
            )) : automation.rules.slice(0, compact ? 3 : 5).map((rule) => (
              <div className="automation-rule inactive" key={rule.id}>
                <div>
                  <strong>{rule.title}</strong>
                  <p>{rule.description}</p>
                </div>
                <em>0</em>
              </div>
            ))}
          </div>

          {compact && (
            <Link className="automation-full-link" href="/dashboard/opportunities">
              Review full pipeline automation <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
