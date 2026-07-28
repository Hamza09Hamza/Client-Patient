import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CLINIC_NAME } from "@/lib/config";
import "./globals.css";

// Three faces, three jobs — see the type block in globals.css.
// latin-ext is not optional here: the interface is French-first, and the
// clinic's own name aside, patient names and test names carry é/è/ç/à.
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_URL = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

// Site-wide default is deliberately unindexable — this app is almost entirely
// behind a login (patient portal and per-patient QR share links). Only the
// sign-in page opts back in — see src/app/login/page.tsx and src/app/robots.ts.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = getDictionary(locale).login;
  const title = `${CLINIC_NAME} — Patient Portal`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${CLINIC_NAME}` },
    description: dict.heroSubtitle,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: dict.heroSubtitle,
      siteName: CLINIC_NAME,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description: dict.heroSubtitle,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
