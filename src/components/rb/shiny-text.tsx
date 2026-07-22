interface ShinyTextProps {
  text: string;
  className?: string;
}

/** ReactBits-style shiny text: a slow highlight sweep across the label. */
export function ShinyText({ text, className }: ShinyTextProps) {
  return (
    <span
      className={`animate-shimmer bg-clip-text text-transparent bg-[length:200%_auto] ${className ?? ""}`}
      style={{
        backgroundImage:
          "linear-gradient(110deg, var(--color-primary-deep) 35%, var(--color-primary) 48%, #67e8f9 52%, var(--color-primary-deep) 65%)",
      }}
    >
      {text}
    </span>
  );
}
