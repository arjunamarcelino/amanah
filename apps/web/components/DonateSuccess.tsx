"use client";

import Link from "next/link";
import { txUrl } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import type { Hex } from "viem";

// Shown as soon as the donation mines — independent of whether the optimistic POST
// succeeded (the on-chain tx is the source of truth; the indexer reconciles).
export function DonateSuccess({ txHash, ledgerPending }: { txHash: Hex; ledgerPending: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-2xl">Thank you for your donation 🤲</h2>
      <p className="text-foreground-soft">
        Your donation is confirmed on-chain
        {ledgerPending ? " and is syncing to the ledger." : "."}
      </p>
      <a
        href={txUrl(txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sm text-primary underline underline-offset-4"
      >
        View transaction on BaseScan
      </a>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href="/ledger">
          <Button variant="outline">View the ledger</Button>
        </Link>
        <Link href="/">
          <Button>Back to campaigns</Button>
        </Link>
      </div>
    </div>
  );
}
