"use client";

import { Button } from "@amanah/ui/button";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";

// Shown in the (wallet) layout once a wallet is active: the connected address + a disconnect
// control, so a donor can disconnect or switch wallet mid-flow. LoginGate only handles the
// logged-out arm (via <DynamicWidget/>); renders nothing until a wallet is active.
export function WalletBar() {
  const { state, logout } = useDonorWallet();
  if (state.status !== "active") return null;

  const { address } = state;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-end gap-3 px-4 pt-4 text-sm">
      <span className="font-mono text-foreground-soft" title={address}>
        {short}
      </span>
      <Button variant="outline" size="sm" onClick={() => void logout()}>
        Disconnect
      </Button>
    </div>
  );
}
