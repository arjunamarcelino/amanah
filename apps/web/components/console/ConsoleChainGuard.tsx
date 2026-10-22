"use client";

import { useState, type ReactNode } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { CHAIN_ID, CHAIN_NAME } from "@amanah/shared";
import { Button } from "@amanah/ui/button";

// Fail-closed network gate for the console. useChainId reacts live to the wallet's
// chainChanged, so switching networks mid-session re-renders this automatically.
// useSwitchChain already handles the 4902 → wallet_addEthereumChain fallback.
export function ConsoleChainGuard({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);

  if (chainId === CHAIN_ID) return <>{children}</>;

  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-card p-6 text-sm">
      <p className="mb-4 text-foreground-soft">
        The operator console runs on {CHAIN_NAME}. Switch your wallet&apos;s network to continue.
      </p>
      <Button
        disabled={isPending}
        onClick={() =>
          switchChain(
            { chainId: CHAIN_ID },
            { onError: (e) => setError(e.message) },
          )
        }
      >
        {isPending ? "Switching…" : `Switch to ${CHAIN_NAME}`}
      </Button>
      {error && <p className="mt-3 text-destructive">{error}</p>}
    </div>
  );
}
