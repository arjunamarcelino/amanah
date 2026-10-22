"use client";

import type { ReactNode } from "react";
import { useAccount, useConnect, useReadContract } from "wagmi";
import { CharityPoolAbi, ADDRESSES, CHAIN_ID, normalizeHex } from "@amanah/shared";
import { Button } from "@amanah/ui/button";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

// Fail-closed owner gate: the console's actions are all onlyOwner, so render children
// ONLY when the connected injected account provably equals CharityPool.owner(). owner()
// is read via the chain-pinned transport (resolves even if the wallet is briefly on the
// wrong chain); a pending/error/mismatch read keeps the console locked. useAccount reacts
// live to accountsChanged, so switching accounts re-runs this with no manual listener.
export function OwnerGate({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect();

  const {
    data: owner,
    isPending: ownerPending,
    isError: ownerError,
  } = useReadContract({
    address: POOL,
    abi: CharityPoolAbi,
    functionName: "owner",
    chainId: CHAIN_ID,
    query: { enabled: isConnected, staleTime: 30_000 },
  });

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <Gate
        title="Connect the owner wallet"
        body="The operator console signs owner-only transactions. Connect the injected wallet (MetaMask) holding the protocol owner key."
      >
        <Button disabled={connecting || !connector} onClick={() => connector && connect({ connector })}>
          {connecting ? "Connecting…" : "Connect wallet"}
        </Button>
        {connectError && <p className="mt-3 text-destructive">{connectError.message}</p>}
      </Gate>
    );
  }

  const isOwner = Boolean(
    address &&
      !ownerPending &&
      !ownerError &&
      owner &&
      normalizeHex(owner) === normalizeHex(address),
  );

  if (!isOwner) {
    return (
      <Gate
        title="Owner wallet required"
        body={
          ownerPending
            ? "Verifying the owner account…"
            : ownerError
              ? "Could not read the contract owner. The console stays locked until this succeeds."
              : "This wallet is not the protocol owner. Switch to the owner account to use the console."
        }
      />
    );
  }

  return <>{children}</>;
}

function Gate({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-lg text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-foreground-soft">{body}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
