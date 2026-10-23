import { LedgerFeed } from "@/components/ledger/LedgerFeed";
import { CompliancePanel } from "@/components/CompliancePanel";

// Public, wallet-free. Lives OUTSIDE the (wallet)/(console) groups, so it mounts neither the
// Dynamic wallet SDK nor the injected config — only the root QueryProvider. Chain is the source of
// truth; the API is the convenience index (LedgerFeed merges both).
export const dynamic = "force-dynamic";

export default function LedgerPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">On-chain · public</p>
        <h1 className="font-serif text-4xl text-foreground">Don&apos;t trust. Verify.</h1>
        <p className="max-w-prose text-foreground-soft">
          Every movement of funds, written straight from Base events. Click any row to confirm it
          yourself on Basescan.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <LedgerFeed />
        <CompliancePanel className="md:sticky md:top-8 md:self-start" />
      </div>
    </main>
  );
}
