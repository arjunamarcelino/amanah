"use client";

import type { ReactNode } from "react";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { assertNever } from "@/lib/assertNever";

// Renders children only once a wallet is active; otherwise shows the right state for each of
// Dynamic's lifecycle phases. The switch is exhaustive — adding a DonorWalletState status
// without a handler is a compile error. The unauthenticated arm uses Dynamic's drop-in
// <DynamicWidget/> as the connect/login button (the account/logout menu lives in the
// (wallet) layout's WalletBar, shown once a wallet is active).
export function LoginGate({ children }: { children: ReactNode }) {
  const { state } = useDonorWallet();

  switch (state.status) {
    case "initializing":
      return <p className="text-sm text-foreground-soft">Loading wallet…</p>;
    case "unauthenticated":
      return (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-foreground-soft">
            Connect a wallet, or log in with email or social, to continue.
          </p>
          <DynamicWidget />
        </div>
      );
    case "provisioning":
      return <p className="text-sm text-foreground-soft">Finishing wallet setup…</p>;
    case "active":
      return <>{children}</>;
    default:
      return assertNever(state);
  }
}
