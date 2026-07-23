/** A minimal decorative trend line — the number next to it is the accessible value. */
export function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 32;
  const pad = 2;
  const max = Math.max(1, ...values);
  const step = (w - pad * 2) / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} className="h-8 w-full text-primary">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
