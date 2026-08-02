"use client";

import { motion } from "framer-motion";
import { Bot, CalendarCheck, CircleDollarSign, MessageCircle, Sparkles, UserRoundCheck } from "lucide-react";

const steps = [
  [MessageCircle, "Visitor lands", "A potential customer opens your site."],
  [Bot, "AI starts", "Vireqo responds instantly with context."],
  [Sparkles, "Intent rises", "Need, urgency and budget are understood."],
  [UserRoundCheck, "Lead added", "A complete opportunity enters your CRM."],
  [CalendarCheck, "Meeting booked", "The right time is scheduled automatically."],
  [CircleDollarSign, "Revenue tracked", "Pipeline value is visible from day one."],
];

export function ProductStory() {
  return (
    <section className="v3-section v3-journey" id="journey">
      <div className="shell">
        <div className="v3-section-heading center"><span>02 · The Vireqo journey</span><h2>Watch AI turn visitors into revenue.</h2><p>Every step is automated, tracked and ready for your team.</p></div>
        <div className="v3-journey-grid">
          {steps.map(([Icon, title, text], index) => (
            <motion.article key={title as string} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ delay: index * .07 }}>
              <div className="v3-step-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="v3-step-icon"><Icon size={21} /></div>
              <h3>{title as string}</h3><p>{text as string}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
