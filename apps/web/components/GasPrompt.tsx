"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@amanah/ui/button";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";

// Base Sepolia ETH faucet (Privy fundWallet is mainnet-only → not used here).
const FAUCET_URL = "https://www.alchemy.com/faucets/base-sepolia";

// Shows a self-fund prompt when the embedded wallet has no gas; otherwise renders
// children. The faucet opens externally (no callback), so we offer an explicit
// recheck that refetches the balance. We also surface the wallet address so the
// donor can fund it directly from any other wallet or exchange, not just the faucet.
export function GasPrompt({ children }: { children: ReactNode }) {
  const { state, refetchBalance } = useDonorWallet();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  if (state.status === "active" && state.needsGas) {
    const address = state.address;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard may be unavailable (insecure context / denied) — the address is
        // still shown in full for manual copy, so this is a no-op fallback.
      }
    };

    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-foreground-soft">
          Your wallet needs a little Base Sepolia ETH for gas before you can mint or donate.
          Use the faucet, or send Base Sepolia ETH to your wallet address from any other wallet
          or exchange.
        </p>

        <div className="flex w-full flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-soft">Your wallet address</span>
          <div className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
              {address}
            </code>
            <Button variant="outline" size="sm" className="shrink-0" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Address copied to clipboard" : ""}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
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
