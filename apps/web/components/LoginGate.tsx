"use client";

import type { ReactNode } from "react";
import { Button } from "@amanah/ui/button";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { assertNever } from "@/lib/assertNever";

// Renders children only once the embedded wallet is active; otherwise shows the right
// state for each of Privy's independent phases. The switch is exhaustive — adding a
// DonorWalletState status without a handler is a compile error.
export function LoginGate({ children }: { children: ReactNode }) {
  const { state, login } = useDonorWallet();

  switch (state.status) {
    case "initializing":
      return <p className="text-sm text-foreground-soft">Loading wallet…</p>;
    case "unauthenticated":
      return <Button onClick={() => login()}>Log in with email or social to continue</Button>;
    case "provisioning":
      return <p className="text-sm text-foreground-soft">Finishing wallet setup…</p>;
    case "active":
      return <>{children}</>;
    default:
      return assertNever(state);
  }
}
