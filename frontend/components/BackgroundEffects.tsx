"use client";

import { useEffect, useState } from "react";

export function BackgroundEffects() {
  const [position, setPosition] = useState({ x: 55, y: 28 });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      setPosition({
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <div className="ambient-layer" aria-hidden="true">
      <div
        className="cursor-aurora"
        style={{ "--mouse-x": `${position.x}%`, "--mouse-y": `${position.y}%` } as React.CSSProperties}
      />
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="ambient-grid" />
      <div className="noise-layer" />
    </div>
  );
}
