"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { TaskPanel } from "@/components/TaskPanel";
import {
  ConfirmDialog,
  EmptyState,
  LoadingSkeleton,
  ToastStack,
  type PolishToast,
} from "@/components/PolishKit";
import { useWorkspaceEvent } from "@/hooks/useWorkspaceRealtime";
import {
  completeTask,
  createTask,
  deleteTask,
  getLeads,
  getTaskSummary,
  getTasks,
  updateTask,
} from "@/lib/api";
import type { Lead, Task, TaskSummary } from "@/lib/types";
import {
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type TaskForm = {
  title: string;
  description: string;
  priority: "urgent" | "high" | "medium" | "low";
  due_at: string;
  lead_id: string;
};

const emptyForm: TaskForm = {
  title: "",
  description: "",
  priority: "medium",
  due_at: "",
  lead_id: "",
};

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function leadLabel(task: Task, leadMap: Map<string, Lead>) {
  if (!task.lead_id) return "Workspace task";
  const lead = leadMap.get(task.lead_id);
  return lead ? `${lead.name}${lead.company ? ` · ${lead.company}` : ""}` : "Linked opportunity";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toasts, setToasts] = useState<PolishToast[]>([]);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [deleteWorking, setDeleteWorking] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("");
  const [dueScope, setDueScope] = useState("");
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);

  function notify(tone: PolishToast["tone"], title: string, message?: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [{ id, tone, title, message }, ...current].slice(0, 4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5200);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [taskItems, taskStats, leadItems] = await Promise.all([
        getTasks({
          status: status || undefined,
          priority: priority || undefined,
          due_scope: dueScope || undefined,
          search: search || undefined,
          limit: 300,
        }),
        getTaskSummary(),
        getLeads({ limit: 300 }),
      ]);
      setTasks(taskItems);
      setSummary(taskStats);
      setLeads(leadItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220);
    return () => window.clearTimeout(timer);
  }, [search, status, priority, dueScope]);

  useWorkspaceEvent(() => {
    void load(true);
  }, ["task.", "lead.", "appointment."]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        lead_id: form.lead_id || null,
        due_at: fromLocalInput(form.due_at),
        source: editingId ? undefined : "manual",
      };

      if (editingId) {
        await updateTask(editingId, payload);
        setSuccess("Task updated.");
        notify("success", "Task updated", "The reminder details were saved.");
      } else {
        await createTask(payload);
        setSuccess("Task created.");
        notify("success", "Task created", "New reminder saved to your workspace.");
      }

      setForm(emptyForm);
      setEditingId(null);
      await load(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save task";
      setError(message);
      notify("error", "Task save failed", message);
    } finally {
      setSaving(false);
    }
  }

  function edit(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      priority: task.priority as TaskForm["priority"],
      due_at: toLocalInput(task.due_at),
      lead_id: task.lead_id ?? "",
    });
    window.setTimeout(() => {
      document.getElementById("task-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function markDone(task: Task) {
    try {
      await completeTask(task.id);
      notify("success", "Task completed", task.title);
      await load(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete task";
      setError(message);
      notify("error", "Task update failed", message);
    }
  }

  function requestRemove(task: Task) {
    setConfirmDeleteTask(task);
  }

  async function confirmRemove() {
    if (!confirmDeleteTask) return;
    setDeleteWorking(true);
    try {
      await deleteTask(confirmDeleteTask.id);
      notify("success", "Task deleted", confirmDeleteTask.title);
      setConfirmDeleteTask(null);
      await load(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete task";
      setError(message);
      notify("error", "Delete failed", message);
    } finally {
      setDeleteWorking(false);
    }
  }

  return (
    <DashboardShell>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="module-heading">
        <div>
          <span className="dashboard-eyebrow">
            <i /> Task system
          </span>
          <h1>Tasks and reminders</h1>
          <p>Create follow-up reminders, convert AI automation into work, and track what is due today.</p>
        </div>
      </div>

      {error && <div className="dashboard-alert">{error}</div>}
      {success && <div className="dashboard-success">{success}</div>}

      <TaskPanel tasks={tasks.filter((task) => task.status === "open")} summary={summary} loading={loading} onComplete={markDone} />

      <form id="task-form" className="dashboard-form-card task-form-card" onSubmit={submit}>
        <div className="settings-card-title">
          {editingId ? <Save size={18} /> : <Plus size={18} />}
          <div>
            <h3>{editingId ? "Edit task" : "Create task"}</h3>
            <p>Link a reminder to a lead or keep it as a workspace-level action.</p>
          </div>
          {editingId && (
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              aria-label="Cancel editing"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="dashboard-form-grid">
          <label>
            <span>Title</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Follow up with Rahul after demo"
            />
          </label>

          <label>
            <span>Priority</span>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskForm["priority"] })}>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label>
            <span>Due date</span>
            <input
              type="datetime-local"
              value={form.due_at}
              onChange={(event) => setForm({ ...form, due_at: event.target.value })}
            />
          </label>

          <label>
            <span>Linked opportunity</span>
            <select value={form.lead_id} onChange={(event) => setForm({ ...form, lead_id: event.target.value })}>
              <option value="">Workspace task</option>
              {leads.map((lead) => (
                <option value={lead.id} key={lead.id}>{lead.name}{lead.company ? ` · ${lead.company}` : ""}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Add context, next step, call notes or goal."
          />
        </label>

        <button className="button button-dashboard" type="submit" disabled={saving}>
          {saving ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
          {editingId ? "Save task" : "Create task"}
        </button>
      </form>

      <div className="module-toolbar task-toolbar">
        <label className="module-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or description" />
        </label>

        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="">All statuses</option>
        </select>

        <select value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select value={dueScope} onChange={(event) => setDueScope(event.target.value)}>
          <option value="">All due dates</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <div className="task-page-list">
          {tasks.map((task) => (
            <article className={`task-page-card priority-${task.priority} status-${task.status}`} key={task.id}>
              <div className="task-page-main">
                <span className="task-page-icon"><CalendarClock size={17} /></span>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.description || "No extra description."}</p>
                  <div className="task-page-meta">
                    <span>{leadLabel(task, leadMap)}</span>
                    <span>{task.priority} priority</span>
                    <span>{task.source}</span>
                    <span>{task.due_at ? new Date(task.due_at).toLocaleString() : "No due date"}</span>
                  </div>
                </div>
              </div>

              <div className="task-page-actions">
                {task.status === "open" && (
                  <button className="button button-dashboard" type="button" onClick={() => void markDone(task)}>
                    <CheckCircle2 size={15} /> Done
                  </button>
                )}
                <button className="button" type="button" onClick={() => edit(task)}>Edit</button>
                <button className="icon-button" type="button" onClick={() => requestRemove(task)} aria-label={`Delete ${task.title}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <EmptyState
          title="No tasks found"
          description={search || priority || dueScope || status !== "open" ? "Try clearing filters or create a fresh reminder from this page." : "Create your first reminder manually, from AI, or from a pipeline automation suggestion."}
          actionLabel="Create task"
          onAction={() => document.getElementById("task-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteTask)}
        title="Delete task?"
        description={confirmDeleteTask ? `This will permanently delete “${confirmDeleteTask.title}”.` : "This task will be removed permanently."}
        confirmLabel="Delete task"
        loading={deleteWorking}
        onCancel={() => setConfirmDeleteTask(null)}
        onConfirm={() => void confirmRemove()}
      />
    </DashboardShell>
  );
}
