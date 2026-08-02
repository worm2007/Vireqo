"use client";

import { motion } from "framer-motion";
import { Building2, Dumbbell, GraduationCap, HeartPulse, Scale } from "lucide-react";
import { useState } from "react";

const industries = {
  Clinic: { icon: HeartPulse, conversations: 856, leads: 208, meetings: 53, revenue: "₹2.91L", prompt: "I want to book a consultation this week." },
  "Real Estate": { icon: Building2, conversations: 1284, leads: 342, meetings: 87, revenue: "₹3.82L", prompt: "I am looking for a 2BHK property this month." },
  "Law Firm": { icon: Scale, conversations: 624, leads: 141, meetings: 36, revenue: "₹4.18L", prompt: "I need legal advice about a contract." },
  Agency: { icon: GraduationCap, conversations: 972, leads: 266, meetings: 61, revenue: "₹3.26L", prompt: "We need more qualified B2B leads." },
  Fitness: { icon: Dumbbell, conversations: 714, leads: 178, meetings: 44, revenue: "₹1.84L", prompt: "I want to join a transformation program." },
};

export function InteractiveDemo() {
  const [active, setActive] = useState<keyof typeof industries>("Clinic");
  const data = industries[active];
  return (
    <section className="v3-section" id="industries">
      <div className="shell">
        <div className="v3-section-heading"><span>03 · Industry experience</span><h2>One platform. Every industry.</h2><p>See how Vireqo adapts to your customers, language and sales process.</p></div>
        <div className="v3-industry-tabs">
          {(Object.keys(industries) as (keyof typeof industries)[]).map(name => {
            const Icon = industries[name].icon;
            return <button key={name} className={active === name ? "active" : ""} onClick={() => setActive(name)}><Icon size={16} />{name}</button>;
          })}
        </div>
        <motion.div key={active} className="v3-industry-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="v3-industry-chat"><div className="v3-card-head"><span className="v3-ai-dot"><data.icon size={14} /></span><div><strong>{active} concierge</strong><small><i /> Online</small></div></div><div className="v3-chat-message assistant">Welcome. How can I help you today?</div><div className="v3-chat-message user">{data.prompt}</div><div className="v3-chat-message assistant">Great. I can qualify this and find the best next step.</div></div>
          <div className="v3-industry-dashboard">
            <div className="v3-industry-metrics"><div><span>Conversations</span><strong>{data.conversations}</strong><small>+19%</small></div><div><span>Qualified leads</span><strong>{data.leads}</strong><small>+23%</small></div><div><span>Meetings booked</span><strong>{data.meetings}</strong><small>+15%</small></div></div>
            <div className="v3-revenue-panel"><span>Revenue generated</span><strong>{data.revenue}</strong><small>+27% this month</small><div className="v3-bars">{[38,46,42,58,61,73,82,95].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
