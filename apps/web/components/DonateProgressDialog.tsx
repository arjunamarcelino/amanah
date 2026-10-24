"use client";

import { useEffect } from "react";
import Link from "next/link";
import { txUrl } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { cn } from "@amanah/ui/lib/utils";
import { CheckIcon } from "@amanah/ui/check-icon";
import type { Hex } from "viem";
import type { TxPhase } from "@/lib/tx";
import type { DonateStage } from "@/lib/hooks/useDonateEngine";

// Modal stepper for the donation flow: Approve → Donate → Done. Overlays the donate page
// (the form stays mounted behind it) and replaces the inline tx-status text. Steps reflect
// the engine's phase/stage; the success and error states live here too.
const STEPS = ["Approve", "Donate", "Done"] as const;

export function DonateProgressDialog({
  open,
  onClose,
  phase,
  stage,
  error,
  txHash,
  ledgerPending,
}: {
  open: boolean;
  onClose: () => void;
  phase: TxPhase;
  stage: DonateStage;
  error?: string | null;
  txHash?: Hex | null;
  ledgerPending: boolean;
}) {
  const pending = phase === "signing" || phase === "mining";

  // Esc closes only when the flow isn't mid-transaction (can't cancel an on-chain tx).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const errored = phase === "error";
  const succeeded = phase === "success";
  // Which step is in play: approve (0) → donate (1) → done (2).
  const current = succeeded ? 2 : stage === "donate" ? 1 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => !pending && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Donation progress"
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        {!pending ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-foreground-soft transition-colors hover:bg-muted"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="size-4">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : null}

        <Stepper current={current} errored={errored} succeeded={succeeded} />

        <div className="mt-6">
          {errored ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-destructive">{error ?? "Something went wrong."}</p>
              <Button variant="outline" onClick={onClose} className="rounded-full">
                Close
              </Button>
            </div>
          ) : succeeded ? (
            <Success txHash={txHash ?? null} ledgerPending={ledgerPending} onClose={onClose} />
          ) : (
            <StatusLine phase={phase} stage={stage} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  current,
  errored,
  succeeded,
}: {
  current: number;
  errored: boolean;
  succeeded: boolean;
}) {
  return (
    <ol className="flex items-center">
      {STEPS.map((label, i) => {
        const isLast = i === STEPS.length - 1;
        const done = i < current || (succeeded && i === 2);
        const active = i === current && !succeeded;
        const stepErrored = active && errored;
        return (
          <li key={label} className={cn("flex items-center", !isLast && "flex-1")}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-full border text-sm font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && !stepErrored && "border-primary text-primary",
                  stepErrored && "border-destructive text-destructive",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <CheckIcon /> : active && !stepErrored ? <Spinner /> : stepErrored ? "!" : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {!isLast ? (
              <span
                className={cn(
                  "mx-2 -mt-5 h-0.5 flex-1 rounded",
                  i < current ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StatusLine({ phase, stage }: { phase: TxPhase; stage: DonateStage }) {
  const label =
    phase === "signing"
      ? "Waiting for your signature…"
      : phase === "mining"
        ? stage === "approve"
          ? "Approving spend…"
          : "Confirming donation…"
        : "Preparing…";
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-sm text-foreground-soft">{label}</p>
      <p className="text-xs text-muted-foreground">Keep this window open until it completes.</p>
    </div>
  );
}

function Success({
  txHash,
  ledgerPending,
  onClose,
}: {
  txHash: Hex | null;
  ledgerPending: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h2 className="font-serif text-2xl text-foreground">Thank you for your donation</h2>
      <p className="text-sm text-foreground-soft">
        Your donation is confirmed on-chain
        {ledgerPending ? " and is syncing to the ledger." : "."}
      </p>
      {txHash ? (
        <a
          href={txUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-primary underline underline-offset-4"
        >
          View transaction on BaseScan
        </a>
      ) : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild className="rounded-full">
          <Link href="/">Back to campaigns</Link>
        </Button>
        <Button variant="outline" onClick={onClose} className="rounded-full">
          Close
        </Button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-4 animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
