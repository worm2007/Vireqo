"use client";

import { DashboardShell } from "@/components/DashboardShell";
import {
  createLead,
  deleteLead,
  getLeads,
  updateLead,
  updateLeadStatus,
} from "@/lib/api";
import type { Lead } from "@/lib/types";
import {
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const statusOptions: Lead["status"][] = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
];

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  need: string;
  budget: string;
  timeline: string;
  source: string;
  status: Lead["status"];
  notes: string;
  score: number;
};

const emptyCreateForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  need: "",
};

function leadToForm(lead: Lead): LeadForm {
  return {
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    company: lead.company ?? "",
    need: lead.need ?? "",
    budget: lead.budget ?? "",
    timeline: lead.timeline ?? "",
    source: lead.source ?? "",
    status: lead.status,
    notes: lead.notes ?? "",
    score: lead.score ?? 0,
  };
}

export default function OpportunitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [temperature, setTemperature] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LeadForm | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      setLeads(
        await getLeads({
          search,
          status,
          temperature,
          limit: 500,
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load opportunities",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, temperature]);

  useEffect(() => {
    const requestedLeadId = searchParams.get("edit");
    if (loading || !requestedLeadId || editingLeadId === requestedLeadId) return;

    const requestedLead = leads.find((lead) => lead.id === requestedLeadId);
    if (!requestedLead) return;

    startEditing(requestedLead);
    router.replace("/dashboard/opportunities", { scroll: false });
  }, [editingLeadId, leads, loading, router, searchParams]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const lead = await createLead({
        ...createForm,
        source: "Dashboard",
      });

      setLeads((current) => [lead, ...current]);
      setCreateForm(emptyCreateForm);
      setShowCreate(false);
      setSuccess("Opportunity created successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create opportunity",
      );
    }
  }

  function startEditing(lead: Lead) {
    setShowCreate(false);
    setError("");
    setSuccess("");
    setEditingLeadId(lead.id);
    setEditForm(leadToForm(lead));

    window.setTimeout(() => {
      document
        .getElementById("edit-opportunity-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function cancelEditing() {
    setEditingLeadId(null);
    setEditForm(null);
    setError("");
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();

    if (!editingLeadId || !editForm) return;

    setSavingEdit(true);
    setError("");
    setSuccess("");

    try {
      const updated = await updateLead(editingLeadId, editForm);

      setLeads((current) =>
        current.map((lead) => (lead.id === updated.id ? updated : lead)),
      );

      setEditingLeadId(null);
      setEditForm(null);
      setSuccess("Opportunity updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update opportunity",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function changeStatus(
    lead: Lead,
    nextStatus: Lead["status"],
  ) {
    const previous = lead.status;

    setLeads((current) =>
      current.map((item) =>
        item.id === lead.id ? { ...item, status: nextStatus } : item,
      ),
    );

    try {
      const updated = await updateLeadStatus(lead.id, nextStatus);

      setLeads((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id ? { ...item, status: previous } : item,
        ),
      );
      setError("Unable to update opportunity status.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this opportunity permanently?")) return;

    setError("");
    setSuccess("");

    try {
      await deleteLead(id);
      setLeads((current) => current.filter((item) => item.id !== id));

      if (editingLeadId === id) {
        cancelEditing();
      }

      setSuccess("Opportunity deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete opportunity",
      );
    }
  }

  return (
    <DashboardShell>
      <div className="module-heading">
        <div>
          <span className="dashboard-eyebrow">
            <i /> CRM
          </span>
          <h1>Opportunities</h1>
          <p>Search, qualify and manage every captured lead.</p>
        </div>

        <button
          className="button button-dashboard"
          type="button"
          onClick={() => {
            setShowCreate((value) => !value);
            cancelEditing();
          }}
        >
          <Plus size={16} />
          Add opportunity
        </button>
      </div>

      {error && <div className="dashboard-alert">{error}</div>}
      {success && <div className="dashboard-success">{success}</div>}

      {showCreate && (
        <form className="dashboard-form-card" onSubmit={submitCreate}>
          <div className="settings-card-title">
            <Plus size={18} />
            <div>
              <h3>Create opportunity</h3>
              <p>Add a lead manually to your CRM.</p>
            </div>
          </div>

          <div className="dashboard-form-grid">
            <label>
              <span>Name</span>
              <input
                required
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    name: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    email: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                value={createForm.phone}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    phone: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Company</span>
              <input
                value={createForm.company}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    company: event.target.value,
                  })
                }
              />
            </label>
          </div>

          <label>
            <span>Need</span>
            <textarea
              required
              value={createForm.need}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  need: event.target.value,
                })
              }
            />
          </label>

          <button className="button button-dashboard" type="submit">
            Create opportunity
          </button>
        </form>
      )}

      {editingLeadId && editForm && (
        <form
          id="edit-opportunity-form"
          className="dashboard-form-card"
          onSubmit={submitEdit}
        >
          <div
            className="settings-card-title"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Pencil size={18} />

              <div>
                <h3>Edit opportunity</h3>
                <p>Update contact, qualification and pipeline details.</p>
              </div>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={cancelEditing}
              aria-label="Close edit form"
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
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    name: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    email: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                value={editForm.phone}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    phone: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Company</span>
              <input
                value={editForm.company}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    company: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Budget</span>
              <input
                value={editForm.budget}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    budget: event.target.value,
                  })
                }
                placeholder="Example: ₹50,000–₹1,00,000"
              />
            </label>

            <label>
              <span>Timeline</span>
              <input
                value={editForm.timeline}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    timeline: event.target.value,
                  })
                }
                placeholder="Example: Within 30 days"
              />
            </label>

            <label>
              <span>Source</span>
              <input
                value={editForm.source}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    source: event.target.value,
                  })
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
                    status: event.target.value as Lead["status"],
                  })
                }
              >
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Intent score</span>
              <input
                type="number"
                min={0}
                max={100}
                value={editForm.score}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    score: Math.max(
                      0,
                      Math.min(100, Number(event.target.value) || 0),
                    ),
                  })
                }
              />
            </label>
          </div>

          <label>
            <span>Need</span>
            <textarea
              value={editForm.need}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  need: event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>Internal notes</span>
            <textarea
              value={editForm.notes}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  notes: event.target.value,
                })
              }
            />
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              className="button button-dashboard"
              type="submit"
              disabled={savingEdit}
            >
              {savingEdit ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              {savingEdit ? "Saving..." : "Save changes"}
            </button>

            <button
              className="button"
              type="button"
              onClick={cancelEditing}
              disabled={savingEdit}
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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, company or need"
          />
        </label>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {statusOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={temperature}
          onChange={(event) => setTemperature(event.target.value)}
        >
          <option value="">All intent levels</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
      </div>

      {loading ? (
        <div className="module-loading">
          <LoaderCircle className="spin" />
          Loading opportunities
        </div>
      ) : (
        <div className="module-list">
          {leads.map((lead) => (
            <article
              className="module-card opportunity-card"
              key={lead.id}
            >
              <div className="module-card-main">
                <span className={`temperature ${lead.temperature}`}>
                  <i />
                  {lead.temperature}
                </span>

                <h3>{lead.name}</h3>

                <p>
                  {lead.company ||
                    lead.email ||
                    lead.phone ||
                    "No contact detail"}
                </p>

                <small>
                  {lead.need || "No qualification note yet"}
                </small>
              </div>

              <div className="opportunity-score">
                <strong>{lead.score}</strong>
                <span>intent</span>
              </div>

              <select
                value={lead.status}
                onChange={(event) =>
                  void changeStatus(
                    lead,
                    event.target.value as Lead["status"],
                  )
                }
                aria-label={`Change ${lead.name} status`}
              >
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <button
                className="button button-dashboard"
                type="button"
                onClick={() => startEditing(lead)}
                style={{
                  minHeight: 38,
                  padding: "0 12px",
                  whiteSpace: "nowrap",
                }}
              >
                <Pencil size={15} />
                Edit
              </button>

              <button
                className="icon-button"
                type="button"
                onClick={() => void remove(lead.id)}
                aria-label={`Delete ${lead.name}`}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}

      {!loading && leads.length === 0 && (
        <div className="module-empty">
          No opportunities match these filters.
        </div>
      )}
    </DashboardShell>
  );
}
