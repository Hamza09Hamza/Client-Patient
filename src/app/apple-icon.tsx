import { ImageResponse } from "next/og";
import { Rod } from "@/components/rod";

// iOS applies its own rounding mask to home-screen icons, so this fills edge
// to edge — see src/app/icon.tsx for the browser-tab favicon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <Rod px={110} />
      </div>
    ),
    { ...size },
  );
}
