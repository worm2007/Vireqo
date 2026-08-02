"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarCheck,
  CircleDollarSign,
  Flame,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

const notifications = [
  {
    icon: UserRoundCheck,
    label: "New qualified lead",
    title: "Northstar Realty",
    detail: "Real estate · 2 property websites",
    accent: "lime",
  },
  {
    icon: Flame,
    label: "Intent score increased",
    title: "92 / 100",
    detail: "+18 points during this conversation",
    accent: "orange",
  },
  {
    icon: CalendarCheck,
    label: "Appointment booked",
    title: "Thursday · 11:30",
    detail: "Calendar confirmation sent",
    accent: "blue",
  },
  {
    icon: CircleDollarSign,
    label: "Pipeline value updated",
    title: "₹78,000",
    detail: "Estimated opportunity value",
    accent: "green",
  },
  {
    icon: Sparkles,
    label: "AI summary prepared",
    title: "Sales-ready context",
    detail: "Need, urgency and next action extracted",
    accent: "violet",
  },
];

export function FloatingNotifications() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % notifications.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  const activeNotification = notifications[activeIndex];
  const ActiveIcon = activeNotification.icon;

  return (
    <div className="floating-notifications" aria-hidden="true">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          className="floating-notification-primary"
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 18,
                  scale: 0.96,
                  filter: "blur(8px)",
                }
          }
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
          }}
          exit={
            reduceMotion
              ? undefined
              : {
                  opacity: 0,
                  y: -12,
                  scale: 0.98,
                  filter: "blur(5px)",
                }
          }
          transition={{
            duration: 0.45,
            ease: [0.2, 0.8, 0.2, 1],
          }}
        >
          <span
            className={`floating-notification-icon accent-${activeNotification.accent}`}
          >
            <ActiveIcon size={16} strokeWidth={1.9} />
          </span>

          <div className="floating-notification-copy">
            <span>{activeNotification.label}</span>
            <strong>{activeNotification.title}</strong>
            <small>{activeNotification.detail}</small>
          </div>

          <span className="floating-notification-status">
            <i />
            Live
          </span>
        </motion.div>
      </AnimatePresence>

      <motion.div
        className="floating-notification-secondary notification-secondary-one"
        animate={
          reduceMotion
            ? undefined
            : {
                y: [0, -7, 0],
                rotate: [-0.5, 0.5, -0.5],
              }
        }
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <span className="secondary-notification-icon">
          <CalendarCheck size={14} />
        </span>

        <div>
          <span>Next action</span>
          <strong>Demo scheduled</strong>
        </div>
      </motion.div>

      <motion.div
        className="floating-notification-secondary notification-secondary-two"
        animate={
          reduceMotion
            ? undefined
            : {
                y: [0, 6, 0],
                x: [0, 3, 0],
              }
        }
        transition={{
          duration: 4.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <span className="secondary-notification-icon secondary-lime">
          <Sparkles size={14} />
        </span>

        <div>
          <span>AI action</span>
          <strong>Summary ready</strong>
        </div>
      </motion.div>
    </div>
  );
}