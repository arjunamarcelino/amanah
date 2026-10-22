import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/lib/privy";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amanah",
  description: "On-chain charitable disaster-relief protocol on Base Sepolia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
