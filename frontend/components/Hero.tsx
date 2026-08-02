"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowUpRight,
  CalendarCheck,
  Check,
  CircleDollarSign,
  Sparkles,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type PointerEvent } from "react";

const events = [
  { icon: UserRoundCheck, label: "Visitor qualified", value: "Northstar Realty", detail: "High intent · 2 websites" },
  { icon: Zap, label: "Intent score updated", value: "92 / 100", detail: "+18 points in this conversation" },
  { icon: CalendarCheck, label: "Meeting booked", value: "Thursday · 11:30", detail: "Confirmation sent automatically" },
  { icon: CircleDollarSign, label: "Pipeline value added", value: "₹78,000", detail: "Opportunity added to CRM" },
];

const chatSequence = [
  { role: "assistant", text: "Hi! What can I help you solve today?" },
  { role: "user", text: "I need help converting more website enquiries." },
  { role: "assistant", text: "Perfect. How many leads do you receive each month?" },
  { role: "user", text: "Around 120. We lose many because replies are late." },
];

function AnimatedNumber({ from, to, suffix = "" }: { from: number; to: number; suffix?: string }) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    const controls = animate(from, to, {
      duration: 2.1,
      delay: 0.75,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: latest => setValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [from, to]);

  return <>{value.toLocaleString("en-IN")}{suffix}</>;
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const [eventIndex, setEventIndex] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState(reduceMotion ? chatSequence.length : 1);
  const [typing, setTyping] = useState(!reduceMotion);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 95, damping: 22 });
  const smoothY = useSpring(pointerY, { stiffness: 95, damping: 22 });
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-4.5, 4.5]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [3.5, -3.5]);
  const shiftX = useTransform(smoothX, [-0.5, 0.5], [-9, 9]);
  const shiftY = useTransform(smoothY, [-0.5, 0.5], [-7, 7]);
  const dashboardRotateY = useTransform(rotateY, value => value * -0.72);
  const dashboardShiftX = useTransform(shiftX, value => value * -0.55);
  const dashboardShiftY = useTransform(shiftY, value => value * -0.45);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => setEventIndex(v => (v + 1) % events.length), 3000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;

    let current = 1;
    const timers: number[] = [];
    const interval = window.setInterval(() => {
      setTyping(true);
      const timer = window.setTimeout(() => {
        current += 1;
        if (current <= chatSequence.length) setVisibleMessages(current);
        setTyping(current < chatSequence.length);
        if (current >= chatSequence.length) window.clearInterval(interval);
      }, 620);
      timers.push(timer);
    }, 1850);

    return () => {
      window.clearInterval(interval);
      timers.forEach(window.clearTimeout);
    };
  }, [reduceMotion]);

  const activeEvent = events[eventIndex];
  const EventIcon = activeEvent.icon;

  const particles = useMemo(
    () => Array.from({ length: 14 }, (_, index) => ({
      id: index,
      left: `${8 + ((index * 17) % 86)}%`,
      top: `${10 + ((index * 23) % 78)}%`,
      delay: `${(index % 7) * 0.35}s`,
      duration: `${4.8 + (index % 5) * 0.75}s`,
    })),
    [],
  );

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <section className="v3-hero shell v3-hero-motion" id="product">
      <div className="v3-hero-ambient" aria-hidden="true">
        <div className="v3-ambient-orb orb-one" />
        <div className="v3-ambient-orb orb-two" />
        <div className="v3-hero-grid" />
        {particles.map(particle => (
          <i
            key={particle.id}
            className="v3-hero-particle"
            style={{
              left: particle.left,
              top: particle.top,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <div className="v3-hero-copy">
        <motion.div
          className="v3-kicker"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="v3-working-pulse"><i /></span>
          <Sparkles size={14} /> AI sales operating system
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
        >
          Your AI sales team <em>never sleeps.</em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16 }}
        >
          Vireqo talks, qualifies, books meetings, updates your CRM, and keeps your pipeline moving while your team focuses on closing.
        </motion.p>

        <motion.div
          className="v3-hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <Link href="/demo" className="v3-button primary v3-magnetic-button">
            <span>Try live AI</span><ArrowUpRight size={18} />
          </Link>
          <Link href="/demo" className="v3-button secondary v3-magnetic-button">Book a demo</Link>
        </motion.div>

        <motion.div
          className="v3-trust-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.38 }}
        >
          <span><Check size={14} /> No credit card</span>
          <span><Check size={14} /> Live demo</span>
          <span><Check size={14} /> Setup in minutes</span>
        </motion.div>
      </div>

      <motion.div
        className="v3-hero-visual v3-hero-visual-motion"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        initial={{ opacity: 0, scale: 0.94, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.95, delay: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        style={reduceMotion ? undefined : { perspective: 1200 }}
      >
        <motion.div className="v3-pointer-glow" style={reduceMotion ? undefined : { x: shiftX, y: shiftY }} />
        <div className="v3-visual-glow" />
        <div className="v3-orbit-line orbit-line-one" />
        <div className="v3-orbit-line orbit-line-two" />

        <motion.div
          className="v3-chat-card v3-floating-surface"
          style={reduceMotion ? undefined : { rotateX, rotateY, x: shiftX, y: shiftY }}
          animate={reduceMotion ? undefined : { translateY: [0, -7, 0] }}
          transition={{ translateY: { duration: 5.2, repeat: Infinity, ease: "easeInOut" } }}
        >
          <div className="v3-card-head">
            <span className="v3-ai-dot"><Sparkles size={14} /></span>
            <div><strong>AI Concierge</strong><small><i /> Online</small></div>
            <span className="v3-live-state">AI working</span>
          </div>

          <div className="v3-live-chat-window">
            <AnimatePresence initial={false}>
              {chatSequence.slice(0, visibleMessages).map((message, index) => (
                <motion.div
                  key={`${message.role}-${index}`}
                  className={`v3-chat-message ${message.role}`}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.32 }}
                >
                  {message.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {typing && (
            <motion.div className="v3-typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <i /><i /><i /> AI is qualifying
            </motion.div>
          )}

          <motion.div
            className="v3-qualified-chip"
            animate={{ opacity: visibleMessages === chatSequence.length ? 1 : 0, y: visibleMessages === chatSequence.length ? 0 : 8 }}
          >
            <UserRoundCheck size={13} /> Qualified · Intent 92
          </motion.div>
        </motion.div>

        <motion.div
          className="v3-dashboard-card v3-floating-surface"
          style={reduceMotion ? undefined : { rotateX, rotateY: dashboardRotateY, x: dashboardShiftX, y: dashboardShiftY }}
          animate={reduceMotion ? undefined : { translateY: [0, 6, 0] }}
          transition={{ translateY: { duration: 6.3, repeat: Infinity, ease: "easeInOut" } }}
        >
          <div className="v3-dashboard-scan" />
          <div className="v3-dashboard-head">
            <div><span>Live overview</span><strong>Pipeline value</strong></div>
            <small><i /> Live · This week</small>
          </div>

          <div className="v3-value">
            ₹3.<AnimatedNumber from={12} to={82} suffix="L" />
            <span>+24%</span>
          </div>

          <svg viewBox="0 0 340 130" className="v3-line-chart" aria-hidden="true">
            <defs>
              <linearGradient id="g-motion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c7ff42" stopOpacity=".36" />
                <stop offset="1" stopColor="#c7ff42" stopOpacity="0" />
              </linearGradient>
              <filter id="line-glow">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d="M8 112 C45 105,55 88,92 94 C125 99,139 69,176 73 C218 77,229 43,268 50 C298 55,317 21,334 12 L334 130 L8 130 Z" fill="url(#g-motion)" />
            <motion.path
              d="M8 112 C45 105,55 88,92 94 C125 99,139 69,176 73 C218 77,229 43,268 50 C298 55,317 21,334 12"
              fill="none"
              stroke="#789f1f"
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#line-glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.1, delay: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            />
            <motion.circle
              cx="334"
              cy="12"
              r="5"
              fill="#c7ff42"
              animate={{ r: [4, 7, 4], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          </svg>

          <div className="v3-mini-metrics">
            <div><span>Conversations</span><strong><AnimatedNumber from={980} to={1248} /></strong><small>+18%</small></div>
            <div><span>Qualified</span><strong><AnimatedNumber from={264} to={342} /></strong><small>+21%</small></div>
            <div><span>Meetings</span><strong><AnimatedNumber from={61} to={87} /></strong><small>+16%</small></div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={eventIndex}
            className="v3-floating-event v3-event-motion"
            initial={{ opacity: 0, y: 16, scale: 0.94, filter: "blur(7px)" }}
            animate={{ opacity: 1, y: [0, -5, 0], scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(5px)" }}
            transition={{ opacity: { duration: 0.35 }, y: { duration: 3.8, repeat: Infinity, ease: "easeInOut" } }}
          >
            <span className="v3-event-icon"><EventIcon size={15} /></span>
            <div><span>{activeEvent.label}</span><strong>{activeEvent.value}</strong><small>{activeEvent.detail}</small></div>
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="v3-floating-meeting v3-meeting-motion"
          animate={reduceMotion ? undefined : { y: [0, 8, 0], rotate: [-0.4, 0.4, -0.4] }}
          transition={{ duration: 4.7, repeat: Infinity, ease: "easeInOut" }}
        >
          <span><CalendarCheck size={13} /> Meeting booked</span>
          <strong>Thursday · 11:30</strong>
        </motion.div>

        <motion.div
          className="v3-revenue-pill"
          animate={reduceMotion ? undefined : { y: [0, -6, 0], opacity: [0.88, 1, 0.88] }}
          transition={{ duration: 3.9, repeat: Infinity, ease: "easeInOut" }}
        >
          <CircleDollarSign size={14} /> Revenue +₹78,000
        </motion.div>
      </motion.div>
    </section>
  );
}
