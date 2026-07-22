"use client";

import { motion, useReducedMotion } from "motion/react";

interface SplitTextProps {
  text: string;
  className?: string;
  /** seconds before the first character starts */
  delay?: number;
  /** seconds between characters */
  stagger?: number;
}

/**
 * ReactBits-style split-text reveal: characters rise and fade in one by one.
 * Renders a single accessible string to screen readers via aria-label.
 */
export function SplitText({ text, className, delay = 0, stagger = 0.03 }: SplitTextProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <span className={className}>{text}</span>;
  }

  // Words stay whole (inline-block + nowrap) so lines only break between
  // words; characters animate individually inside each word.
  const words = text.split(" ");
  let charIndex = 0;

  return (
    <span className={className} aria-label={text} role="text">
      {words.map((word, w) => {
        const start = charIndex;
        charIndex += word.length + 1; // +1 keeps stagger rhythm across spaces
        return (
          <span key={w} aria-hidden className="inline-block whitespace-nowrap">
            {Array.from(word).map((char, c) => (
              <motion.span
                key={c}
                className="inline-block"
                initial={{ opacity: 0, y: "0.6em", filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: delay + (start + c) * stagger,
                  duration: 0.45,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {char}
              </motion.span>
            ))}
            {w < words.length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        );
      })}
    </span>
  );
}
