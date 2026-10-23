"use client";

import { useState, type ReactNode } from "react";
import { useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";

// Ensures the active wallet is on Base Sepolia before the gated UI runs any tx.
// No-op until the wallet is active (LoginGate handles the earlier phases).
export function ChainGuard({ children }: { children: ReactNode }) {
  const { state } = useDonorWallet();
  const { switchChain, isPending } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);

  if (state.status !== "active" || state.isBaseSepolia) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {/* Plain <img>: next/image would need dangerouslyAllowSVG to serve this SVG mark. */}
      <img src="/chains/base-logo.svg" alt="Base" width={79} height={20} className="h-5 w-auto" />
      <p className="text-sm text-foreground-soft">Switch your wallet to Base Sepolia to continue.</p>
      <Button
        disabled={isPending}
        onClick={() => {
          setError(null);
          switchChain(
            { chainId: CHAIN_ID },
            { onError: (e) => setError(e.message) },
          );
        }}
      >
        {isPending ? "Switching…" : "Switch to Base Sepolia"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
