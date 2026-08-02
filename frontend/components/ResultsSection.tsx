"use client";

import { openVireqoChat } from "@/lib/uiEvents";
import { ArrowUpRight, BarChart3, Bot, CalendarCheck, MessagesSquare, Route, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";

const modules = [
  [Bot, "AI Concierge", "Human-like conversations that answer, qualify and convert."],
  [MessagesSquare, "Smart CRM", "Every lead, message and next action in one place."],
  [Sparkles, "Lead Scoring", "Identify high-intent opportunities automatically."],
  [CalendarCheck, "Appointment Booking", "Book meetings and reduce no-shows."],
  [BarChart3, "Analytics", "See what creates pipeline and revenue."],
  [Workflow, "Automations", "Run follow-ups and workflows while you sleep."],
];

export function ResultsSection() {
  return (
    <>
      <section className="v3-section v3-modules">
        <div className="shell"><div className="v3-section-heading"><span>04 · Powerful modules</span><h2>Everything you need. Built for growth.</h2></div><div className="v3-module-grid">{modules.map(([Icon,title,text])=><article key={title as string}><div><Icon size={20}/></div><h3>{title as string}</h3><p>{text as string}</p></article>)}</div></div>
      </section>
      <section className="v3-section" id="results">
        <div className="shell"><div className="v3-section-heading"><span>05 · Real outcomes</span><h2>Less manual work. More qualified pipeline.</h2></div><div className="v3-results-grid"><div><strong>24/7</strong><span>Instant lead coverage</span></div><div><strong>&lt;3 sec</strong><span>Average response time</span></div><div><strong>1 view</strong><span>Complete lead context</span></div><div><strong>100%</strong><span>Trackable conversations</span></div></div></div>
      </section>
      <section className="v3-section v3-integrations"><div className="shell"><div className="v3-section-heading center"><span>06 · Connect everything</span><h2>Works where your business works.</h2><p>Website, email, calendars and CRMs—connected through one intelligent operating layer.</p></div><div className="v3-integration-cloud">{["Website","WhatsApp","Instagram","Email","Google Calendar","HubSpot","Slack","Salesforce","Pipedrive","Telegram"].map((x,i)=><span key={x} style={{animationDelay:`${i*.08}s`}}>{i%3===0?<Route size={15}/>:<Sparkles size={15}/>} {x}</span>)}</div></div></section>
      <section className="v3-final-cta shell"><div><span>07 · Ready to grow?</span><h2>Turn your website into a 24/7 sales machine.</h2><p>Experience Vireqo with a live AI conversation and see how every enquiry becomes a real opportunity.</p><div><Link href="/demo" className="v3-button lime">Book live demo <ArrowUpRight size={18}/></Link><button type="button" className="v3-button dark" onClick={() => openVireqoChat()}>Try AI concierge</button></div></div><div className="v3-orbit"><i/><i/><i/><strong>V</strong></div></section>
    </>
  );
}
