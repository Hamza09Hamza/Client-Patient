"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  /** seconds */
  delay?: number;
  /** px the element rises while fading in */
  y?: number;
  /** animate when scrolled into view instead of on mount */
  inView?: boolean;
}

/** ReactBits-style animated content reveal (opacity + rise). */
export function FadeIn({ children, className, delay = 0, y = 16, inView = false }: FadeInProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  const visible = { opacity: 1, y: 0 };
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      {...(inView
        ? { whileInView: visible, viewport: { once: true, margin: "-40px" } }
        : { animate: visible })}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
