/**
 * Soft aurora background: two slow-drifting teal blobs behind the content.
 * Pure CSS animation (GPU transforms only); freezes under reduced motion.
 */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <div
        className="animate-float-slow absolute -top-1/4 -left-1/6 h-[70%] w-[55%] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(8 145 178 / 0.35), rgb(8 145 178 / 0.12) 60%, transparent)",
        }}
      />
      <div
        className="animate-float-slower absolute -bottom-1/4 -right-1/6 h-[75%] w-[60%] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(22 163 74 / 0.28), rgb(34 211 238 / 0.14) 55%, transparent)",
        }}
      />
    </div>
  );
}
