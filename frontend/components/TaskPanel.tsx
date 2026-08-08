"use client";

import type { Task, TaskSummary } from "@/lib/types";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ListTodo,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

function formatDue(value?: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(task: Task) {
  return Boolean(task.status === "open" && task.due_at && new Date(task.due_at).getTime() < Date.now());
}

type TaskPanelProps = {
  tasks: Task[];
  summary: TaskSummary | null;
  loading?: boolean;
  compact?: boolean;
  onComplete?: (task: Task) => void | Promise<void>;
};

export function TaskPanel({ tasks, summary, loading = false, compact = false, onComplete }: TaskPanelProps) {
  const visible = tasks.slice(0, compact ? 5 : 10);

  if (loading) {
    return (
      <section className="task-panel-card loading">
        <LoaderCircle className="spin" size={20} />
        <div>
          <strong>Loading tasks</strong>
          <span>Checking reminders, due dates and follow-ups…</span>
        </div>
      </section>
    );
  }

  return (
    <section className={`task-panel-card${compact ? " compact" : ""}`}>
      <div className="task-panel-header">
        <div>
          <span className="executive-kicker">
            <ListTodo size={14} /> Task system
          </span>
          <h2>{summary?.headline ?? "Turn pipeline signals into tasks."}</h2>
          <p>Persistent reminders keep follow-ups, meetings and qualification work from slipping.</p>
        </div>
        <Link className="button button-dashboard" href="/dashboard/tasks">
          Open tasks <ArrowRight size={15} />
        </Link>
      </div>

      <div className="task-summary-grid">
        <div className={summary?.overdue ? "risk" : ""}>
          <AlertTriangle size={16} />
          <strong>{summary?.overdue ?? 0}</strong>
          <span>overdue</span>
        </div>
        <div>
          <CalendarClock size={16} />
          <strong>{summary?.due_today ?? 0}</strong>
          <span>today</span>
        </div>
        <div>
          <Sparkles size={16} />
          <strong>{summary?.high_priority ?? 0}</strong>
          <span>priority</span>
        </div>
        <div>
          <CheckCircle2 size={16} />
          <strong>{summary?.completed ?? 0}</strong>
          <span>done</span>
        </div>
      </div>

      <div className="task-mini-list">
        {visible.length ? visible.map((task) => (
          <article className={`task-mini-card priority-${task.priority}${isOverdue(task) ? " overdue" : ""}`} key={task.id}>
            <div className="task-mini-main">
              <span className="task-state-dot"><CircleDot size={13} /></span>
              <div>
                <strong>{task.title}</strong>
                <small>{task.description || `${task.priority} priority · ${task.source}`}</small>
                <em>{formatDue(task.due_at)}</em>
              </div>
            </div>
            {task.status === "open" && onComplete && (
              <button className="task-complete-button" type="button" onClick={() => void onComplete(task)}>
                <CheckCircle2 size={14} /> Done
              </button>
            )}
          </article>
        )) : (
          <div className="automation-empty-state">
            <CheckCircle2 size={22} />
            <strong>No open tasks right now</strong>
            <span>Create manual tasks or convert automation suggestions into reminders.</span>
          </div>
        )}
      </div>
    </section>
  );
}
