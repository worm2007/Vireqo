"use client";

import { useEffect, useState } from "react";

type MousePosition = {
  x: number;
  y: number;
};

export function useMousePosition(): MousePosition {
  const [position, setPosition] = useState<MousePosition>({
    x: 50,
    y: 35,
  });

  useEffect(() => {
    const updatePosition = (event: PointerEvent) => {
      setPosition({
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("pointermove", updatePosition, {
      passive: true,
    });

    return () => {
      window.removeEventListener("pointermove", updatePosition);
    };
  }, []);

  return position;
}