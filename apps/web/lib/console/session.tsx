"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, Hex } from "viem";

// Session seam shared by the release, route, halal-toggle and state-readout controls.
// It carries the release→route payout forward IN MEMORY (demo: one controlled session;
// refresh-recovery is an explicit non-goal). Four controls depend on this interface,
// not on each other's internals — so they can be built in parallel.

/** The actual (possibly cap-limited) values parsed from the TrancheReleased event. */
export type PayoutReady = {
  payoutId: Hex;
  campaignId: Hex;
  beneficiary: Address;
  usdcAmount: bigint;
};

export type PayoutContext =
  | { status: "none" }
  | ({ status: "ready" } & PayoutReady)
  | { status: "routed"; txHash: Hex };

type ConsoleSession = {
  /** Selected campaign slug (null until one is chosen). */
  selectedSlug: string | null;
  setSelectedSlug: (slug: string | null) => void;
  pendingPayout: PayoutContext;
  /** Set after a successful releaseTranche (parsed event values). */
  setReleased: (p: PayoutReady) => void;
  /** Set after a successful recordAndPay. */
  setRouted: (txHash: Hex) => void;
  /** Clear the payout (e.g. on campaign switch). */
  resetPayout: () => void;
  /** True while a tranche is released but not yet routed — locks the halal toggle. */
  locked: boolean;
};

const Ctx = createContext<ConsoleSession | null>(null);

export function ConsoleSessionProvider({ children }: { children: ReactNode }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [pendingPayout, setPendingPayout] = useState<PayoutContext>({ status: "none" });

  const value = useMemo<ConsoleSession>(
    () => ({
      selectedSlug,
      setSelectedSlug: (slug) => {
        setSelectedSlug(slug);
        setPendingPayout({ status: "none" }); // switching campaigns clears any carried payout
      },
      pendingPayout,
      setReleased: (p) => setPendingPayout({ status: "ready", ...p }),
      setRouted: (txHash) => setPendingPayout({ status: "routed", txHash }),
      resetPayout: () => setPendingPayout({ status: "none" }),
      locked: pendingPayout.status === "ready",
    }),
    [selectedSlug, pendingPayout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsoleSession(): ConsoleSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConsoleSession must be used within ConsoleSessionProvider");
  return ctx;
}
