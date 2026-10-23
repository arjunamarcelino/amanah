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
  // app/icon.svg is picked up automatically; this also wires the SVG as the shortcut icon.
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Amanah",
    title: "Amanah",
    description,
    // Drop a 1200×630 PNG at apps/web/public/og.png (see apps/landing/public/og.png).
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Amanah" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Amanah",
    description,
    images: ["/og.png"],
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
