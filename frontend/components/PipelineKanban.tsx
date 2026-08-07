"use client";

import type { Lead, LeadPrediction } from "@/lib/types";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flame,
  GripVertical,
  Pencil,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { DragEvent, useMemo, useState } from "react";

const pipelineColumns: Array<{
  status: Lead["status"];
  title: string;
  subtitle: string;
  accent: string;
}> = [
  {
    status: "new",
    title: "New",
    subtitle: "Fresh opportunities",
    accent: "stone",
  },
  {
    status: "contacted",
    title: "Contacted",
    subtitle: "Conversation started",
    accent: "blue",
  },
  {
    status: "qualified",
    title: "Qualified",
    subtitle: "Ready for proposal",
    accent: "lime",
  },
  {
    status: "won",
    title: "Won",
    subtitle: "Closed revenue",
    accent: "green",
  },
  {
    status: "lost",
    title: "Lost",
    subtitle: "Not moving ahead",
    accent: "red",
  },
];

type PipelineKanbanProps = {
  leads: Lead[];
  predictionMap: Map<string, LeadPrediction>;
  onStatusChange: (lead: Lead, nextStatus: Lead["status"]) => void | Promise<void>;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void | Promise<void>;
};

function sortByPriority(items: Lead[], predictionMap: Map<string, LeadPrediction>) {
  return [...items].sort((a, b) => {
    const predictionA = predictionMap.get(a.id);
    const predictionB = predictionMap.get(b.id);
    const scoreA = predictionA?.score ?? a.score ?? 0;
    const scoreB = predictionB?.score ?? b.score ?? 0;

    if (scoreB !== scoreA) return scoreB - scoreA;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function getContactLine(lead: Lead) {
  return lead.company || lead.email || lead.phone || "No contact detail";
}

export function PipelineKanban({
  leads,
  predictionMap,
  onStatusChange,
  onEdit,
  onDelete,
}: PipelineKanbanProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeDropStatus, setActiveDropStatus] = useState<Lead["status"] | null>(null);

  const grouped = useMemo(() => {
    return pipelineColumns.reduce<Record<Lead["status"], Lead[]>>(
      (acc, column) => {
        acc[column.status] = sortByPriority(
          leads.filter((lead) => lead.status === column.status),
          predictionMap,
        );
        return acc;
      },
      {
        new: [],
        contacted: [],
        qualified: [],
        won: [],
        lost: [],
      },
    );
  }, [leads, predictionMap]);

  function handleDragStart(event: DragEvent<HTMLElement>, lead: Lead) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lead.id);
    setDraggingId(lead.id);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: Lead["status"]) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain") || draggingId;
    const lead = leads.find((item) => item.id === leadId);

    setDraggingId(null);
    setActiveDropStatus(null);

    if (!lead || lead.status === status) return;

    void onStatusChange(lead, status);
  }

  const totalOpen = grouped.new.length + grouped.contacted.length + grouped.qualified.length;
  const wonCount = grouped.won.length;

  return (
    <section className="pipeline-kanban-shell" aria-label="Sales pipeline Kanban board">
      <div className="pipeline-kanban-header">
        <div>
          <span className="dashboard-eyebrow">
            <i /> Sales pipeline
          </span>
          <h2>Drag opportunities across the board to move deals forward.</h2>
          <p>
            Prioritized by predictive score, conversion chance and latest activity.
          </p>
        </div>

        <div className="pipeline-kanban-summary">
          <div>
            <strong>{totalOpen}</strong>
            <span>open deals</span>
          </div>
          <div>
            <strong>{wonCount}</strong>
            <span>won</span>
          </div>
          <div>
            <strong>{leads.length}</strong>
            <span>visible</span>
          </div>
        </div>
      </div>

      <div className="pipeline-kanban-board">
        {pipelineColumns.map((column, index) => {
          const columnLeads = grouped[column.status];
          const isActiveDrop = activeDropStatus === column.status;

          return (
            <div
              className={`pipeline-column pipeline-${column.accent} ${isActiveDrop ? "is-drop-target" : ""}`}
              key={column.status}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setActiveDropStatus(column.status);
              }}
              onDragLeave={() => setActiveDropStatus(null)}
              onDrop={(event) => handleDrop(event, column.status)}
            >
              <div className="pipeline-column-head">
                <div>
                  <span>{column.title}</span>
                  <small>{column.subtitle}</small>
                </div>
                <strong>{columnLeads.length}</strong>
              </div>

              <div className="pipeline-column-body">
                {columnLeads.map((lead) => {
                  const prediction = predictionMap.get(lead.id);
                  const score = prediction?.score ?? lead.score ?? 0;
                  const closeChance = prediction?.conversion_probability;
                  const temperature = prediction?.temperature ?? lead.temperature;
                  const isDragging = draggingId === lead.id;

                  return (
                    <article
                      className={`pipeline-card ${isDragging ? "is-dragging" : ""}`}
                      draggable
                      key={lead.id}
                      onDragStart={(event) => handleDragStart(event, lead)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setActiveDropStatus(null);
                      }}
                    >
                      <div className="pipeline-card-topline">
                        <span className={`pipeline-temperature ${temperature}`}>
                          <i />
                          {temperature}
                        </span>
                        <GripVertical size={16} />
                      </div>

                      <div className="pipeline-card-title">
                        <span>
                          <UserRound size={16} />
                        </span>
                        <div>
                          <h3>{lead.name}</h3>
                          <p>{getContactLine(lead)}</p>
                        </div>
                      </div>

                      <p className="pipeline-card-need">
                        {lead.need || "No qualification note yet."}
                      </p>

                      <div className="pipeline-card-metrics">
                        <div>
                          <strong>{score}</strong>
                          <span>score</span>
                        </div>
                        <div>
                          <strong>{closeChance != null ? `${closeChance}%` : "—"}</strong>
                          <span>close</span>
                        </div>
                      </div>

                      {prediction && (
                        <div className="pipeline-card-intel">
                          <span>
                            <Sparkles size={14} />
                            {prediction.next_action}
                          </span>
                          {prediction.risks.slice(0, 1).map((risk) => (
                            <em key={risk}>
                              <AlertTriangle size={13} />
                              {risk}
                            </em>
                          ))}
                        </div>
                      )}

                      <div className="pipeline-card-footer">
                        <div className="pipeline-stage-actions" aria-label={`Move ${lead.name} to another stage`}>
                          {pipelineColumns.map((stage, stageIndex) => {
                            const disabled = stage.status === lead.status;
                            const isNextStage = stageIndex === index + 1;
                            return (
                              <button
                                aria-label={`Move ${lead.name} to ${stage.title}`}
                                className={isNextStage ? "next-stage" : ""}
                                disabled={disabled}
                                key={stage.status}
                                onClick={() => void onStatusChange(lead, stage.status)}
                                type="button"
                              >
                                {isNextStage ? <ArrowRight size={12} /> : null}
                                {stage.title}
                              </button>
                            );
                          })}
                        </div>

                        <div className="pipeline-card-actions">
                          <button
                            aria-label={`Edit ${lead.name}`}
                            onClick={() => onEdit(lead)}
                            type="button"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label={`Delete ${lead.name}`}
                            onClick={() => void onDelete(lead.id)}
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {columnLeads.length === 0 && (
                  <div className="pipeline-empty-column">
                    {column.status === "won" ? <CheckCircle2 size={18} /> : <Flame size={18} />}
                    <span>No {column.title.toLowerCase()} opportunities.</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
