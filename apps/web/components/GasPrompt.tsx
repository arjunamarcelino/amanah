"use client";

import type { ReactNode } from "react";
import { Button } from "@amanah/ui/button";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";

// Base Sepolia ETH faucet (Privy fundWallet is mainnet-only → not used here).
const FAUCET_URL = "https://portal.cdp.coinbase.com/products/faucet?token=base-sepolia-eth";

// Shows a self-fund prompt when the embedded wallet has no gas; otherwise renders
// children. The faucet opens externally (no callback), so we offer an explicit
// recheck that refetches the balance.
export function GasPrompt({ children }: { children: ReactNode }) {
  const { state, refetchBalance } = useDonorWallet();

  if (state.status === "active" && state.needsGas) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-foreground-soft">
          Your wallet needs a little Base Sepolia ETH for gas before you can mint or donate.
        </p>
        <div className="flex gap-2">
          <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
            <Button>Get testnet ETH</Button>
          </a>
          <Button variant="outline" onClick={() => refetchBalance()}>
            I&apos;ve funded — recheck
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
