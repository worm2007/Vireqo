"use client";

import { ArrowUpRight, ChevronDown, Pencil } from "lucide-react";
import Link from "next/link";
import type { Lead } from "@/lib/types";

const statuses: Lead["status"][] = ["new", "contacted", "qualified", "won", "lost"];

export function LeadTable({ leads, onStatus }: { leads: Lead[]; onStatus: (lead: Lead, status: Lead["status"]) => void }) {
  return (
    <div className="lead-table-wrap">
      <div className="lead-table-head">
        <div><h3>Opportunity stream</h3><p>Prioritised by live intent and recency.</p></div>
        <Link href="/dashboard/opportunities">View all <ArrowUpRight size={15} /></Link>
      </div>
      <div className="lead-table-scroll">
        <table className="lead-table">
          <thead><tr><th>Contact</th><th>Intent</th><th>Temperature</th><th>Status</th><th>Source</th><th /></tr></thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td><div className="contact-cell"><span>{lead.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{lead.name}</strong><small>{lead.company || lead.email || "Independent"}</small></div></div></td>
                <td><div className="score-cell"><strong>{lead.score}</strong><div><span style={{ width: `${lead.score}%` }} /></div></div></td>
                <td><span className={`temperature ${lead.temperature}`}><i />{lead.temperature}</span></td>
                <td>
                  <label className="status-select"><select value={lead.status} onChange={(event) => onStatus(lead, event.target.value as Lead["status"])}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown size={13} /></label>
                </td>
                <td><span className="source-text">{lead.source}</span></td>
                <td>
                  <Link className="row-menu" href={`/dashboard/opportunities?edit=${lead.id}`} aria-label={`Edit ${lead.name}`} title={`Edit ${lead.name}`}>
                    <Pencil size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
