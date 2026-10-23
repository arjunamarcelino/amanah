import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { siteConfig } from "@/lib/site";
import "./globals.css";

// Self-hosted from committed .woff2 (latin, variable) so the build needs no network —
// see docker/landing.Dockerfile. Both are variable fonts covering the full weight range;
// `font-optical-sizing: auto` (globals.css) drives Fraunces' opsz axis.
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

const description =
  "Give to any cause and an automated router sends your donation on-chain by the " +
  "cheapest path — near-zero fees, any stablecoin, and transparent from end to end.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Amanah — Give once. Protect many. Lose nothing to the middle.",
    template: "%s · Amanah",
  },
  description,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  // Favicon set lives in public/ (generated); Next renders these into <head>.
  icons: {
    icon: [{ url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" }],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: { title: siteConfig.name },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: "Amanah — Give once. Protect many. Lose nothing to the middle.",
    description,
    images: [{ url: "/amanah-og.png", width: 1730, height: 909, alt: "Amanah" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Amanah — Give once. Protect many. Lose nothing to the middle.",
    description,
    images: ["/amanah-og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#faf7f0",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>
        {/* Marks JS active before paint so scroll-reveal hides its start state only
            when motion can run; with JS off, content renders in its final state. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        {children}
      </body>
    </html>
  );
}
