import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

// Self-hosted from committed .woff2 (latin, variable) so the build needs no network.
// Shared with apps/landing for brand continuity.
const fraunces = localFont({
  src: "./fonts/Fraunces-latin.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-fraunces",
});

const hanken = localFont({
  src: "./fonts/HankenGrotesk-latin.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-sans",
});

const description = "On-chain charitable disaster-relief protocol on Base Sepolia.";

// Absolute base for OG/Twitter image URLs. NEXT_PUBLIC_APP_URL in prod (app.amanah.help);
// falls back to the public domain so social cards resolve even if the env var is unset.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.amanah.help";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Amanah",
  description,
  // Favicon set lives in public/ (generated); Next renders these into <head>.
  icons: {
    icon: [{ url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" }],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: { title: "Amanah" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Amanah",
    title: "Amanah",
    description,
    images: [{ url: "/amanah-og.png", width: 1730, height: 909, alt: "Amanah" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Amanah",
    description,
    images: ["/amanah-og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#faf7f0",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
