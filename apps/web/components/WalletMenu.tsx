"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { Button } from "@amanah/ui/button";
import { cn } from "@amanah/ui/lib/utils";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { useCopied } from "@/lib/hooks/useCopied";

// Right slot of the SiteHeader: the single auth surface in the chrome. Connecting a wallet
// happens ONLY on /login, so the logged-out arm is a link there — never an inline connect
// widget. Once a wallet is active it becomes an address pill that opens a small account menu
// (full address, network, gas balance, faucet, disconnect). Built by hand (click-outside +
// Escape) because @amanah/ui ships no popover primitive.
export function WalletMenu() {
  const { state, logout } = useDonorWallet();

  if (state.status === "initializing" || state.status === "provisioning") {
    return (
      <span className="hidden text-sm text-foreground-soft sm:inline" role="status">
        {state.status === "initializing" ? "Loading…" : "Connecting…"}
      </span>
    );
  }

  if (state.status !== "active") {
    return (
      <Button asChild size="sm" className="rounded-full px-4 font-semibold">
        <Link href="/login">Sign In</Link>
      </Button>
    );
  }

  return (
    <AccountMenu
      address={state.address}
      isBaseSepolia={state.isBaseSepolia}
      nativeBalance={state.nativeBalance}
      needsGas={state.needsGas}
      onLogout={() => void logout()}
    />
  );
}

function AccountMenu({
  address,
  isBaseSepolia,
  nativeBalance,
  needsGas,
  onLogout,
}: {
  address: `0x${string}`;
  isBaseSepolia: boolean;
  nativeBalance: bigint;
  needsGas: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopied();
  const ref = useRef<HTMLDivElement>(null);
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 4 significant figures is plenty for a testnet gas readout.
  const eth = Number(formatEther(nativeBalance)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-input bg-background py-1.5 pl-2 pr-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            isBaseSepolia ? "bg-primary" : "bg-destructive",
          )}
        />
        <span className="font-mono">{short}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-border/70 bg-popover shadow-xl shadow-foreground/5"
        >
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Connected wallet
            </p>
            {/* The whole row is the copy control — click copies the full address. */}
            <button
              type="button"
              onClick={() => copy(address)}
              aria-label={copied ? "Address copied" : "Copy wallet address"}
              className="group/copy mt-1 flex w-full items-start gap-2 rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="break-all font-mono text-sm text-foreground group-hover/copy:text-primary" title={address}>
                {address}
              </span>
              <span className="mt-0.5 shrink-0 text-foreground-soft group-hover/copy:text-primary">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </span>
            </button>
            <span
              role="status"
              className={cn(
                "mt-1 block text-xs text-primary transition-opacity",
                copied ? "opacity-100" : "opacity-0",
              )}
            >
              Copied to clipboard
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-y-2 px-4 py-3 text-sm">
            <dt className="text-foreground-soft">Network</dt>
            <dd className={cn("text-right font-medium", isBaseSepolia ? "text-foreground" : "text-destructive")}>
              {isBaseSepolia ? "Base Sepolia" : "Wrong network"}
            </dd>
            <dt className="text-foreground-soft">Gas</dt>
            <dd className="text-right font-mono text-foreground">{eth} ETH</dd>
          </dl>

          {needsGas ? (
            <p className="mx-4 mb-3 rounded-md bg-muted px-3 py-2 text-xs text-foreground-soft">
              No testnet ETH yet — you&apos;ll be prompted to fund gas before a transaction.
            </p>
          ) : null}

          <div className="flex flex-col gap-1 border-t border-border/60 p-2">
            <Link
              href="/mint"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Mint test tokens
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-3.5 text-foreground-soft transition-transform duration-200", open && "rotate-180")}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-4"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-4 text-primary"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
