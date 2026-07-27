"use client";

// Last-resort boundary: only fires if the root layout itself throws, so it
// deliberately avoids depending on the app's own components/fonts/CSS —
// those may be exactly what's broken. Plain inline styles only.
import { useEffect, useState } from "react";

function readLocaleCookie(): "en" | "fr" {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  return match?.[1] === "fr" ? "fr" : "en";
}

const COPY = {
  en: { title: "Something went wrong", description: "Please try again.", retry: "Try again" },
  fr: { title: "Une erreur est survenue", description: "Veuillez réessayer.", retry: "Réessayer" },
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale] = useState<"en" | "fr">(() => readLocaleCookie());

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = COPY[locale];

  return (
    <html lang={locale}>
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f7f7f5",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>{copy.title}</h1>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: "0 0 20px" }}>{copy.description}</p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#0f766e",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
