"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { captureLead } from "@/lib/api";

export function InteractiveDemo() {
  const [form, setForm] = useState({ name: "", email: "", company: "", need: "" });
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [score, setScore] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("loading");
    try {
      const lead = await captureLead({ ...form, timeline: "Requested website demo" });
      setScore(lead.score);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="experience-section" id="experience">
      <div className="shell experience-grid">
        <div className="experience-copy">
          <span className="section-kicker light">A demo that creates a real lead</span>
          <h2>Don’t watch the product. Enter the system.</h2>
          <p>Submit this form while the backend is running. Vireqo scores the enquiry, stores it in the CRM and updates the dashboard automatically.</p>
          <div className="experience-points">
            <span><Check size={16} /> Real API request</span>
            <span><Check size={16} /> Persistent database record</span>
            <span><Check size={16} /> Immediate lead score</span>
          </div>
        </div>
        <div className="capture-panel">
          <div className="capture-head"><span><Sparkles size={15} /> Live capture</span><i>Secured</i></div>
          <AnimatePresence mode="wait">
            {state === "success" ? (
              <motion.div className="success-state" key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="success-ring"><strong>{score}</strong><span>intent score</span></div>
                <h3>Opportunity created.</h3>
                <p>Your enquiry is now inside the Vireqo CRM as a qualified signal.</p>
                <button className="button button-dark" onClick={() => { setState("idle"); setForm({ name: "", email: "", company: "", need: "" }); }}>Create another</button>
              </motion.div>
            ) : (
              <motion.form onSubmit={submit} key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="field-row">
                  <label><span>Your name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Anubhav Tiwari" /></label>
                  <label><span>Work email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" /></label>
                </div>
                <label><span>Business</span><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Your company or brand" /></label>
                <label><span>What should Vireqo solve?</span><textarea required value={form.need} onChange={(e) => setForm({ ...form, need: e.target.value })} placeholder="We need to capture and qualify enquiries after business hours..." /></label>
                {state === "error" && <p className="form-error">The API is not reachable. Start the FastAPI server, then try again.</p>}
                <button className="button button-dark full-button" disabled={state === "loading"}>
                  {state === "loading" ? <><LoaderCircle className="spin" size={18} /> Scoring opportunity</> : <>Enter the pipeline <ArrowRight size={18} /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
