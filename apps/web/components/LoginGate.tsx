"use client";

import type { ReactNode } from "react";
import { Button } from "@amanah/ui/button";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";

// Renders children only once the embedded wallet is active; otherwise shows the
// right state for each of Privy's independent phases (initializing / unauthenticated
// / provisioning). Children can safely read the active wallet via useDonorWallet.
export function LoginGate({ children }: { children: ReactNode }) {
  const { state, login } = useDonorWallet();

  if (state.status === "initializing") {
    return <p className="text-sm text-foreground-soft">Loading wallet…</p>;
  }
  if (state.status === "unauthenticated") {
    return (
      <Button onClick={() => login()}>Log in with email or social to continue</Button>
    );
  }
  if (state.status === "provisioning") {
    return <p className="text-sm text-foreground-soft">Finishing wallet setup…</p>;
  }
  return <>{children}</>;
}
