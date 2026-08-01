"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowUpRight, Check, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const rise = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay, ease: [0.2, 0.8, 0.2, 1] },
  }),
};

const liveSignals = [
  { label: "Visitor identified", value: "Northstar Realty", detail: "Real estate · 2 websites" },
  { label: "Intent recalculated", value: "92 / 100", detail: "+18 points in this conversation" },
  { label: "Smart route complete", value: "Assigned to Maya K.", detail: "Response SLA · under 2 minutes" },
  { label: "Appointment secured", value: "Thursday · 11:30", detail: "Confirmation sent automatically" },
];

function AnimatedScore() {
  const [score, setScore] = useState(67);

  useEffect(() => {
    const controls = animate(67, 92, {
      duration: 2.2,
      delay: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (value) => setScore(Math.round(value)),
    });
    return () => controls.stop();
  }, []);

  return <>{score}</>;
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 100, damping: 22 });
  const springY = useSpring(pointerY, { stiffness: 100, damping: 22 });
  const rotateY = useTransform(springX, [-0.5, 0.5], [-4, 4]);
  const rotateX = useTransform(springY, [-0.5, 0.5], [3, -3]);
  const [signalIndex, setSignalIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSignalIndex((current) => (current + 1) % liveSignals.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const signal = liveSignals[signalIndex];

  return (
    <section className="hero shell">
      <div className="hero-copy">
        <motion.div className="eyebrow" variants={rise} initial="hidden" animate="visible" custom={0.05}>
          <Sparkles size={14} /> AI lead operating system
        </motion.div>
        <motion.h1 variants={rise} initial="hidden" animate="visible" custom={0.12}>
          Your website already has customers. <em>Vireqo finds them.</em>
        </motion.h1>
        <motion.p className="hero-lead" variants={rise} initial="hidden" animate="visible" custom={0.2}>
          Turn anonymous visitors into qualified opportunities with an intelligent concierge, live intent scoring, automated routing and a CRM your team will actually enjoy using.
        </motion.p>
        <motion.div className="hero-actions" variants={rise} initial="hidden" animate="visible" custom={0.28}>
          <Link className="button button-premium" href="/demo">
            Try the AI concierge <ArrowUpRight size={18} />
          </Link>
          <a className="button button-ghost button-premium" href="#experience">
            Watch the system work
          </a>
        </motion.div>
        <motion.div className="trust-strip" variants={rise} initial="hidden" animate="visible" custom={0.34}>
          <span><Check size={14} /> No credit card</span>
          <span><Check size={14} /> Live product demo</span>
          <span><Check size={14} /> Setup in minutes</span>
        </motion.div>
        <motion.div className="hero-proof" variants={rise} initial="hidden" animate="visible" custom={0.4}>
          <div><strong>&lt; 3 sec</strong><span>instant response</span></div>
          <div><strong>24/7</strong><span>lead coverage</span></div>
          <div><strong>1 view</strong><span>complete context</span></div>
        </motion.div>
      </div>

      <motion.div
        className="hero-stage"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        initial={{ opacity: 0, scale: 0.94, rotateX: 5 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
        transition={{ duration: 1, delay: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="stage-glow" />
        <motion.div className="stage-window" style={reduceMotion ? undefined : { rotateX, rotateY }}>
          <div className="stage-scanline" />
          <div className="stage-topbar">
            <div className="window-dots"><span /><span /><span /></div>
            <span>Live acquisition signal</span>
            <span className="live-pill"><i /> Live</span>
          </div>
          <div className="stage-content">
            <div className="stage-sidebar">
              <span className="mini-mark" />
              {[0, 1, 2, 3, 4].map((item) => <span className={item === 0 ? "active" : ""} key={item} />)}
            </div>
            <div className="stage-main">
              <div className="stage-title-row">
                <div><span className="tiny-label">Opportunity</span><h3>Northstar Realty</h3></div>
                <motion.div className="score-orbit" animate={{ boxShadow: ["0 0 0 rgba(199,255,66,0)", "0 0 34px rgba(199,255,66,.25)", "0 0 0 rgba(199,255,66,0)"] }} transition={{ duration: 2.8, repeat: Infinity }}>
                  <strong><AnimatedScore /></strong><span>intent</span>
                </motion.div>
              </div>
              <div className="signal-grid">
                <div className="signal-card wide">
                  <span className="tiny-label">Conversation intelligence</span>
                  <motion.div className="chat-line left" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
                    We need an AI lead system for two property websites.
                  </motion.div>
                  <motion.div className="chat-line right" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}>
                    Perfect. Are you looking to launch this month?
                  </motion.div>
                  <div className="typing"><i /><i /><i /></div>
                </div>
                <div className="signal-card metric-card">
                  <span className="tiny-label">Lead temperature</span>
                  <strong>Hot</strong>
                  <div className="heat-track"><motion.span initial={{ width: "22%" }} animate={{ width: "88%" }} transition={{ duration: 1.8, delay: 1.1 }} /></div>
                  <small>Ready for sales</small>
                </div>
                <div className="signal-card route-card">
                  <span className="tiny-label">Smart route</span>
                  <div className="route-person"><span>MK</span><div><strong>Maya K.</strong><small>Assigned instantly</small></div></div>
                  <button>Open opportunity <ArrowUpRight size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          key={signalIndex}
          className="floating-card floating-one signal-toast"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: [0, -7, 0], scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ opacity: { duration: 0.35 }, y: { duration: 4, repeat: Infinity } }}
        >
          <div className="toast-icon"><Zap size={15} /></div>
          <span>{signal.label}</span>
          <strong>{signal.value}</strong>
          <small>{signal.detail}</small>
        </motion.div>

        <motion.div className="floating-card floating-two" animate={{ y: [0, 8, 0] }} transition={{ duration: 4.8, repeat: Infinity }}>
          <div className="pulse-icon" /><span>Appointment booked</span><strong>Thursday · 11:30</strong>
        </motion.div>

        <motion.div className="micro-signal micro-signal-one" animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
          +18 intent
        </motion.div>
        <motion.div className="micro-signal micro-signal-two" animate={{ y: [0, -5, 0] }} transition={{ duration: 3.6, repeat: Infinity }}>
          AI summary ready
        </motion.div>
      </motion.div>
    </section>
  );
}
