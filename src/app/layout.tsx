import type { Metadata } from "next";
import { Figtree, Noto_Sans } from "next/font/google";
import { getLocale } from "@/lib/i18n/locale";
import { CLINIC_NAME } from "@/lib/config";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${CLINIC_NAME} — Patient Portal`,
    template: `%s · ${CLINIC_NAME}`,
  },
  description: "Secure access to your laboratory results.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${figtree.variable} ${notoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
