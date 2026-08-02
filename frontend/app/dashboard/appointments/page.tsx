"use client";

import { DashboardShell } from "@/components/DashboardShell";
import {
  createAppointment,
  deleteAppointment,
  getAppointments,
  getCurrentUser,
  updateAppointment,
} from "@/lib/api";
import type { Appointment } from "@/lib/types";
import {
  CalendarDays,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const statuses: Appointment["status"][] = [
  "booked",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

const statusLabels: Record<Appointment["status"], string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

type AppointmentForm = {
  name: string;
  email: string;
  phone: string;
  starts_at: string;
  status: Appointment["status"];
  note: string;
};

const emptyCreateForm = {
  name: "",
  email: "",
  phone: "",
  starts_at: "",
  note: "",
};

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function appointmentToForm(item: Appointment): AppointmentForm {
  return {
    name: item.name,
    email: item.email ?? "",
    phone: item.phone ?? "",
    starts_at: toLocalDateTimeInput(item.starts_at),
    status: item.status,
    note: item.note ?? "",
  };
}

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [businessSlug, setBusinessSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "past">("all");
  const [form, setForm] = useState(emptyCreateForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AppointmentForm | null>(null);

  useEffect(() => {
    Promise.all([getAppointments(), getCurrentUser()])
      .then(([appointments, user]) => {
        setItems(appointments);
        setBusinessSlug(user.business.slug);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load appointments"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const now = Date.now();

    return items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;

      const startsAt = new Date(item.starts_at).getTime();
      if (dateFilter === "upcoming" && startsAt < now) return false;
      if (dateFilter === "past" && startsAt >= now) return false;

      if (!clean) return true;
      return [item.name, item.email, item.phone, item.note, item.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(clean));
    });
  }, [dateFilter, items, query, statusFilter]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    clearMessages();
    setSaving(true);

    try {
      const appointment = await createAppointment({
        ...form,
        business_slug: businessSlug,
        starts_at: new Date(form.starts_at).toISOString(),
      });

      setItems((current) => [appointment, ...current]);
      setForm(emptyCreateForm);
      setShowCreate(false);
      setSuccess("Appointment booked successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book appointment");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item: Appointment) {
    clearMessages();
    setShowCreate(false);
    setEditingId(item.id);
    setEditForm(appointmentToForm(item));

    window.setTimeout(() => {
      document
        .getElementById("edit-appointment-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId || !editForm) return;

    clearMessages();
    setSaving(true);

    try {
      const updated = await updateAppointment(editingId, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        starts_at: new Date(editForm.starts_at).toISOString(),
        status: editForm.status,
        note: editForm.note,
      });

      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      cancelEditing();
      setSuccess("Appointment updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update appointment");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(item: Appointment, status: Appointment["status"]) {
    clearMessages();
    const previous = item.status;

    setItems((current) =>
      current.map((value) =>
        value.id === item.id ? { ...value, status } : value,
      ),
    );

    try {
      const updated = await updateAppointment(item.id, { status });
      setItems((current) =>
        current.map((value) => (value.id === item.id ? updated : value)),
      );
      setSuccess("Appointment status updated.");
    } catch (err) {
      setItems((current) =>
        current.map((value) =>
          value.id === item.id ? { ...value, status: previous } : value,
        ),
      );
      setError(err instanceof Error ? err.message : "Unable to update appointment");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this appointment permanently?")) return;

    clearMessages();
    try {
      await deleteAppointment(id);
      setItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) cancelEditing();
      setSuccess("Appointment deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete appointment");
    }
  }

  const minimumDate = toLocalDateTimeInput(new Date().toISOString());

  return (
    <DashboardShell>
      <div className="module-heading">
        <div>
          <span className="dashboard-eyebrow"><i /> Calendar</span>
          <h1>Appointments</h1>
          <p>Book, reschedule and manage every customer call.</p>
        </div>

        <button
          className="button button-dashboard"
          type="button"
          onClick={() => {
            clearMessages();
            cancelEditing();
            setShowCreate((value) => !value);
          }}
        >
          <Plus size={16} />
          Book appointment
        </button>
      </div>

      {error && <div className="dashboard-alert">{error}</div>}
      {success && <div className="dashboard-success">{success}</div>}

      {showCreate && (
        <form className="dashboard-form-card" onSubmit={submitCreate}>
          <div className="settings-card-title">
            <CalendarDays size={18} />
            <div>
              <h3>Book appointment</h3>
              <p>Create a new meeting in this workspace.</p>
            </div>
          </div>

          <div className="dashboard-form-grid">
            <label>
              <span>Name</span>
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>

            <label>
              <span>Start time</span>
              <input
                required
                type="datetime-local"
                min={minimumDate}
                value={form.starts_at}
                onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
              />
            </label>
          </div>

          <label>
            <span>Note</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>

          <div className="dashboard-form-actions">
            <button className="button button-dashboard" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <CalendarDays size={16} />}
              {saving ? "Booking..." : "Book appointment"}
            </button>
            <button
              className="button"
              type="button"
              disabled={saving}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {editingId && editForm && (
        <form
          id="edit-appointment-form"
          className="dashboard-form-card"
          onSubmit={submitEdit}
        >
          <div className="settings-card-title dashboard-card-title-split">
            <div className="dashboard-card-title-group">
              <Pencil size={18} />
              <div>
                <h3>Edit appointment</h3>
                <p>Update the contact, schedule, outcome or internal note.</p>
              </div>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={cancelEditing}
              aria-label="Close appointment editor"
            >
              <X size={17} />
            </button>
          </div>

          <div className="dashboard-form-grid">
            <label>
              <span>Name</span>
              <input
                required
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                value={editForm.phone}
                onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
              />
            </label>

            <label>
              <span>Start time</span>
              <input
                required
                type="datetime-local"
                min={minimumDate}
                value={editForm.starts_at}
                onChange={(event) =>
                  setEditForm({ ...editForm, starts_at: event.target.value })
                }
              />
            </label>

            <label>
              <span>Status</span>
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    status: event.target.value as Appointment["status"],
                  })
                }
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            <span>Internal note</span>
            <textarea
              value={editForm.note}
              onChange={(event) => setEditForm({ ...editForm, note: event.target.value })}
            />
          </label>

          <div className="dashboard-form-actions">
            <button className="button button-dashboard" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              className="button"
              type="button"
              disabled={saving}
              onClick={cancelEditing}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="module-toolbar">
        <label className="module-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, phone or note"
          />
        </label>

        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(event) =>
            setDateFilter(event.target.value as "all" | "upcoming" | "past")
          }
        >
          <option value="all">All dates</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
      </div>

      {loading ? (
        <div className="module-loading">
          <LoaderCircle className="spin" />
          Loading appointments
        </div>
      ) : (
        <div className="module-list">
          {filteredItems.map((item) => (
            <article className="module-card appointment-card" key={item.id}>
              <div className="conversation-icon">
                <CalendarDays size={18} />
              </div>

              <div className="module-card-main">
                <span className={`appointment-status appointment-status-${item.status}`}>
                  {statusLabels[item.status]}
                </span>
                <h3>{item.name}</h3>
                <p className="appointment-time">
                  <Clock3 size={13} />
                  {new Date(item.starts_at).toLocaleString()}
                </p>
                <small>{item.email || item.phone || item.note || "No extra details"}</small>
              </div>

              <select
                value={item.status}
                onChange={(event) =>
                  void setStatus(item, event.target.value as Appointment["status"])
                }
                aria-label={`Change ${item.name} appointment status`}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>

              <button
                className="button button-dashboard compact-dashboard-button"
                type="button"
                onClick={() => startEditing(item)}
              >
                <Pencil size={15} />
                Edit
              </button>

              <button
                className="icon-button"
                type="button"
                onClick={() => void remove(item.id)}
                aria-label={`Delete ${item.name} appointment`}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="module-empty">No appointments match these filters.</div>
      )}
    </DashboardShell>
  );
}
