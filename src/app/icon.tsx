import { ImageResponse } from "next/og";

// Matches src/components/brand.tsx's BrandMark (primary-colored rounded
// square + the lucide "activity" glyph) so the browser tab / bookmark icon
// and search-result favicon are the same mark used everywhere in the UI.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0891b2",
          borderRadius: 7,
        }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
