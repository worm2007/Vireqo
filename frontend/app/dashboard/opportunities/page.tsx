"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { useWorkspaceEvent } from "@/hooks/useWorkspaceRealtime";
import {
  createLead,
  deleteLead,
  getLeadIntelligence,
  getLeads,
  updateLead,
  updateLeadStatus,
} from "@/lib/api";
import type { Lead, LeadIntelligence } from "@/lib/types";
import {
  BrainCircuit,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [intelligence, setIntelligence] = useState<LeadIntelligence | null>(null);
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

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");

    try {
      const [items, predictive] = await Promise.all([
        getLeads({
          search,
          status,
          temperature,
          limit: 500,
        }),
        getLeadIntelligence().catch(() => null),
      ]);

      setLeads(items);
      setIntelligence(predictive);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load opportunities",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, temperature]);

  useWorkspaceEvent(() => {
    void load(true);
  }, ["lead."]);

  const predictionMap = useMemo(() => {
    return new Map((intelligence?.predictions ?? []).map((item) => [item.lead_id, item]));
  }, [intelligence]);

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

  const topPrediction = intelligence?.predictions[0] ?? null;
  const topLead = topPrediction
    ? leads.find((lead) => lead.id === topPrediction.lead_id)
    : null;

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


      {intelligence && (
        <section className="predictive-intelligence-strip">
          <div className="predictive-strip-copy">
            <span className="dashboard-eyebrow">
              <i /> Predictive intelligence
            </span>
            <h2>Lead scoring and conversion prediction are now active.</h2>
            <p>{intelligence.summary.recommended_focus}</p>
          </div>

          <div className="predictive-strip-metrics">
            <div>
              <strong>{intelligence.summary.average_score}</strong>
              <span>avg score</span>
            </div>
            <div>
              <strong>{intelligence.summary.average_conversion_probability}%</strong>
              <span>avg close chance</span>
            </div>
            <div>
              <strong>{intelligence.summary.high_intent_count}</strong>
              <span>high intent</span>
            </div>
            <div>
              <strong>{intelligence.summary.at_risk_count}</strong>
              <span>at risk</span>
            </div>
          </div>

          {topLead && topPrediction && (
            <button
              className="predictive-best-lead"
              type="button"
              onClick={() => startEditing(topLead)}
            >
              <BrainCircuit size={17} />
              <span>
                <small>Best predicted opportunity</small>
                <strong>{topLead.name}</strong>
              </span>
              <em>{topPrediction.conversion_probability}%</em>
            </button>
          )}
        </section>
      )}

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
          {leads.map((lead) => {
            const prediction = predictionMap.get(lead.id);
            const score = prediction?.score ?? lead.score;
            const temperature = prediction?.temperature ?? lead.temperature;

            return (
              <article
                className="module-card opportunity-card predictive-opportunity-card"
                key={lead.id}
              >
                <div className="module-card-main">
                  <span className={`temperature ${temperature}`}>
                    <i />
                    {temperature}
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

                  {prediction && (
                    <div className="lead-prediction-details">
                      <div>
                        <strong>{prediction.conversion_label}</strong>
                        <span>{prediction.next_action}</span>
                      </div>

                      <div className="lead-prediction-tags">
                        {prediction.reasons.slice(0, 2).map((reason) => (
                          <em key={reason}>{reason}</em>
                        ))}
                        {prediction.risks.slice(0, 1).map((risk) => (
                          <em className="risk" key={risk}>{risk}</em>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="opportunity-score predictive-score">
                  <strong>{score}</strong>
                  <span>score</span>
                  <em>{prediction ? `${prediction.conversion_probability}% close` : "predicting"}</em>
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
            );
          })}
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
