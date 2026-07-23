"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";

interface LiquidGlassProps {
  children: ReactNode;
  className?: string;
}

/**
 * A hand-rolled, CSS-only take on reactbits.dev's "Fluid Glass" — a frosted
 * panel with a sheen that follows the pointer. The original is a Three.js
 * scene that refracts a 3D background through a lens mesh, which only makes
 * sense wrapped around a WebGL scene, not live DOM/iframe content (like a
 * PDF), so this reproduces the visual language (translucency, a moving
 * specular highlight, a soft chromatic halo) in plain CSS instead — same
 * look, none of the Three.js/GLB weight, works over any content.
 */
export function LiquidGlass({ children, className }: LiquidGlassProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
      el.style.setProperty("--sheen-opacity", "0.9");
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "20%");
    el.style.setProperty("--sheen-opacity", "0.5");
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`liquid-glass ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
