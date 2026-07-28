/**
 * Hero graphic for the login brand panel: a schematic microplate (the actual
 * tray a diagnostic lab runs samples in — a grid of wells, most still empty,
 * a few already read) plus instrument-style tick marks along the edge.
 * Deliberately not a decorative gradient — every element maps to something a
 * lab technician would recognize, and the "scan" animation traces exactly
 * one row at a time, the way a plate reader actually works.
 *
 * Replaces the earlier abstract aurora-blob treatment, which read as
 * generic "health tech" rather than anything specific to a diagnostic lab.
 */

const COLS = 12;
const ROWS = 8;
const CELL = 16;
const GAP = 5;
const STEP = CELL + GAP; // keep in sync with the plate-scan keyframe in globals.css

// Deterministic "read" wells — fixed, not random, so server and client render
// identically and the pattern looks intentional rather than noisy.
const READ_WELLS = new Set([
  "0,0", "0,1", "0,3", "0,6",
  "1,0", "1,1", "1,2", "1,3", "1,4", "1,6", "1,9",
  "2,0", "2,1", "2,2", "2,3", "2,4", "2,5", "2,6", "2,9", "2,10",
  "3,1", "3,2",
]);

export function SpecimenPlate({ className }: { className?: string }) {
  const width = COLS * STEP - GAP;
  const height = ROWS * STEP - GAP;
  const tickSpan = height + 28;

  return (
    <div aria-hidden className={`pointer-events-none absolute ${className ?? ""}`}>
      <svg
        viewBox={`-30 -14 ${width + 60} ${tickSpan + 20}`}
        width={width + 60}
        height={tickSpan + 20}
        fill="none"
      >
        {/* Ruler ticks — an instrument reads this plate top to bottom */}
        {Array.from({ length: 15 }).map((_, i) => {
          const y = (i / 14) * height;
          const major = i % 2 === 0;
          return (
            <line
              key={i}
              x1={-14}
              y1={y}
              x2={major ? -6 : -9}
              y2={y}
              stroke="white"
              strokeOpacity={major ? 0.35 : 0.18}
              strokeWidth={1}
            />
          );
        })}
        <line x1={-14} y1={-2} x2={-14} y2={height + 2} stroke="white" strokeOpacity={0.2} strokeWidth={1} />

        {/* The plate grid itself */}
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((_, c) => {
            const cx = c * STEP + CELL / 2;
            const cy = r * STEP + CELL / 2;
            const read = READ_WELLS.has(`${r},${c}`);
            return (
              <circle
                key={`${r}-${c}`}
                cx={cx}
                cy={cy}
                r={CELL / 2}
                fill={read ? "white" : "none"}
                fillOpacity={read ? 0.16 : 0}
                stroke="white"
                strokeOpacity={read ? 0.5 : 0.14}
                strokeWidth={1}
              />
            );
          }),
        )}

        {/* Plate reader sweep — one row scanned at a time, then resets; a real
            plate reader moves row by row, not as a diffuse glow. */}
        <rect
          x={-4}
          y={0}
          width={width + 8}
          height={CELL + 4}
          rx={CELL / 2 + 2}
          fill="url(#scan-gradient)"
          className="animate-plate-scan"
        />
        <defs>
          <linearGradient id="scan-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="0.1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
