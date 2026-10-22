import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Providers } from "@/lib/privy";
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

export const metadata: Metadata = {
  title: "Amanah",
  description: "On-chain charitable disaster-relief protocol on Base Sepolia.",
};

export const viewport: Viewport = {
  themeColor: "#faf7f0",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
