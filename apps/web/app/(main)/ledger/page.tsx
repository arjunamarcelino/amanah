import type { Metadata } from "next";
import Image from "next/image";
import { LedgerFeed } from "@/components/ledger/LedgerFeed";
import { LedgerStats } from "@/components/ledger/LedgerStats";
import { CompliancePanel } from "@/components/CompliancePanel";

export const metadata: Metadata = {
  title: "Ledger | Amanah",
};

// Public ledger. Lives in the (main) group so it shares the SiteHeader (and the Dynamic
// providers mounted there for the header's wallet control), but the page itself reads nothing
// from the wallet. Chain is the source of truth; the API is the convenience index (LedgerFeed
// merges both).
export const dynamic = "force-dynamic";

export default function LedgerPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          On-chain · Public
        </p>
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
          Don&apos;t trust. Verify.
        </h1>
        <p className="text-lg text-foreground-soft">
          Every movement of funds, written straight from Base events. Click any row to confirm it
          yourself on BaseScan.
        </p>
        <p className="flex items-center gap-2 text-sm text-foreground-soft">
          <span>Live on</span>
          <Image
            src="/chains/base-logo.svg"
            alt="Base"
            width={75}
            height={19}
            className="h-[1.1rem] w-auto"
          />
        </p>
      </header>

      <LedgerStats />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <LedgerFeed />
        <CompliancePanel className="rounded-2xl lg:sticky lg:top-[5.5rem] lg:self-start" />
      </div>
    </main>
  );
}
