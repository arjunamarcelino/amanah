import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-fraunces",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
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
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: "Amanah — Give once. Protect many. Lose nothing to the middle.",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Amanah" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Amanah — Give once. Protect many. Lose nothing to the middle.",
    description,
    images: ["/og.png"],
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
