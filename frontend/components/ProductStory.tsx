"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, BrainCircuit, CalendarCheck, MessagesSquare, Radar, Route } from "lucide-react";

const steps = [
  { number: "01", icon: MessagesSquare, title: "Engage", text: "A precise AI concierge opens the right conversation at the right moment." },
  { number: "02", icon: BrainCircuit, title: "Understand", text: "Every message becomes structured context—not another disconnected chat." },
  { number: "03", icon: Radar, title: "Qualify", text: "Intent, urgency and fit become a live score your team can act on." },
  { number: "04", icon: Route, title: "Route", text: "High-value opportunities reach the right person without manual handoffs." },
  { number: "05", icon: CalendarCheck, title: "Convert", text: "The next action is clear: follow up, schedule, nurture or close." },
];

export function ProductStory() {
  return (
    <section className="story-section" id="system">
      <div className="shell">
        <div className="section-heading split-heading">
          <div><span className="section-kicker">One continuous intelligence layer</span><h2>From first signal to closed customer.</h2></div>
          <p>Vireqo removes the quiet gaps where valuable enquiries disappear. Every interaction stays connected, scored and ready for action.</p>
        </div>
        <div className="journey-line">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.article
                className="journey-card"
                key={step.title}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.65, delay: index * 0.08 }}
              >
                <div className="journey-top"><span>{step.number}</span><Icon size={23} /></div>
                <h3>{step.title}</h3><p>{step.text}</p>
                <ArrowDownRight size={20} className="journey-arrow" />
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
