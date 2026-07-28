import { ImageResponse } from "next/og";
import { Rod } from "@/components/rod";

// The browser-tab favicon: the monogram's rod on the monogram's marine.
// See src/components/rod.tsx for why the icons use the rod rather than a
// shrunken copy of the full CA mark.
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
          background: "#1d3f96",
          borderRadius: 7,
        }}
      >
        <Rod />
      </div>
    ),
    { ...size },
  );
}
