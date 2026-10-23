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
        <Button
          disabled={connecting || !connector}
          onClick={() => connector && connect({ connector })}
          className="rounded-full px-6 font-semibold"
        >
          {connecting ? "Connecting…" : "Connect wallet"}
        </Button>
        {connectError ? (
          <p className="mt-3 text-sm text-destructive">{connectErrorMessage(connectError)}</p>
        ) : null}
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

// Map wagmi connect errors to operator-friendly guidance. ProviderNotFoundError means no
// injected wallet owns window.ethereum — almost always "no wallet extension installed".
function connectErrorMessage(err: Error): string {
  const text = `${err.name} ${err.message}`;
  if (/ProviderNotFound|Provider not found/i.test(text)) {
    return "No browser wallet detected. Install MetaMask (or another EVM wallet extension), then reload this page.";
  }
  if (/User rejected|rejected the request/i.test(text)) {
    return "Connection request was rejected in your wallet.";
  }
  return err.message;
}

function Gate({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-7">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <h2 className="mt-4 font-serif text-2xl tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-foreground-soft">{body}</p>
      {children ? <div className="mt-5 flex flex-col items-center">{children}</div> : null}
    </main>
  );
}
