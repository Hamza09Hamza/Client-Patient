"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

interface CountUpProps {
  to: number;
  className?: string;
  duration?: number;
  delay?: number;
}

/** ReactBits-style count-up number, tabular figures so layout never shifts. */
export function CountUp({ to, className, duration = 1.1, delay = 0 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      node.textContent = String(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [to, duration, delay, reduced]);

  return (
    <span ref={ref} className={`tnum ${className ?? ""}`}>
      {reduced ? to : 0}
    </span>
  );
}
