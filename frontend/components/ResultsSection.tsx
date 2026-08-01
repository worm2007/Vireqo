"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function ResultsSection() {
  return (
    <section className="results-section" id="results">
      <div className="shell">
        <div className="results-banner">
          <div className="results-copy"><span className="section-kicker">Built for decisive teams</span><h2>Less chasing.<br />More signal.</h2></div>
          <div className="results-metrics">
            {[['01', 'Every lead in one context-rich workspace'], ['02', 'No missed follow-up hidden in an inbox'], ['03', 'Clear next action for every opportunity']].map(([number, text], index) => (
              <motion.div key={number} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.12 }}>
                <span>{number}</span><p>{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="closing-cta">
          <span className="cta-orbit" />
          <p>Somewhere, your next customer is deciding who responds first.</p>
          <h2>Make every signal count.</h2>
          <Link className="button" href="/signup">Build your pipeline <ArrowUpRight size={18} /></Link>
        </div>
      </div>
    </section>
  );
}
