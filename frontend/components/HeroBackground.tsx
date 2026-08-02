"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMousePosition } from "@/hooks/useMousePosition";

export function HeroBackground() {
  const reduceMotion = useReducedMotion();
  const { x, y } = useMousePosition();

  return (
    <div className="hero-background" aria-hidden="true">
      <div className="hero-background-base" />

      <motion.div
        className="hero-pointer-light"
        animate={{
          left: `${x}%`,
          top: `${y}%`,
        }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 45,
                damping: 20,
                mass: 0.8,
              }
        }
      />

      <motion.div
        className="hero-orb hero-orb-lime"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 65, 15, 0],
                y: [0, -35, 45, 0],
                scale: [1, 1.12, 0.96, 1],
              }
        }
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="hero-orb hero-orb-forest"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -55, 20, 0],
                y: [0, 40, -25, 0],
                scale: [1, 0.92, 1.08, 1],
              }
        }
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="hero-grid-overlay" />
      <div className="hero-vignette" />
    </div>
  );
}