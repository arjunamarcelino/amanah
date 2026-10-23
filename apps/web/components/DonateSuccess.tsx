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
      {/* Pine success mark with a paper checkmark (from donation-success.svg). */}
      <svg
        aria-hidden="true"
        width={72}
        height={72}
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="64" cy="64" r="60" fill="#14532d" fillOpacity="0.08" />
        <circle cx="64" cy="64" r="48" fill="#14532d" />
        <path
          d="M43 64L57 78L85 50"
          stroke="#FFF9EF"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <h2 className="text-2xl">Thank you for your donation</h2>
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
        <Link href="/">
          <Button>Back to campaigns</Button>
        </Link>
      </div>
    </div>
  );
}
