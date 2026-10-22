import type { ReleaseType } from "@amanah/shared";

// Pure derivation of "where is this campaign in the operator flow" from chain reads
// (+ the two session booleans for the route/paid tail). One tested function instead of
// scattered per-card booleans; the exhaustive switch in the UI is guarded by assertNever,
// so a new step can't be added without wiring its control. Invest-idle and accrue are
// always-available side actions, NOT steps — yield deployment has no reliable on-chain
// read, so we surface Invest as an action with a hint rather than gating the machine on it.

export type OperatorReads = {
  donated: bigint;
  released: bigint;
  /** undefined when the campaign is not registered on the ReleaseController. */
  releaseType: ReleaseType | undefined;
  /** ReleaseController.canRelease — trigger fired / milestone approved. */
  canRelease: boolean;
  /** Unix seconds the condition was activated (0 when not yet activated). */
  activatedAt: bigint;
  /** CharityPool.releaseDelay (T+N), in seconds. */
  releaseDelay: bigint;
  /** Current time, unix seconds (passed in — keeps this function pure). */
  now: bigint;
  /** session.pendingPayout.status === "ready" (a tranche was released, not yet routed). */
  hasPendingPayout: boolean;
  /** session.pendingPayout.status === "routed" (recordAndPay confirmed). */
  routed: boolean;
};

export type OperatorStep =
  | { step: "awaiting_donations" }
  | { step: "needs_trigger"; releaseType: ReleaseType | undefined }
  | { step: "awaiting_unlock"; unlockAt: bigint }
  | { step: "fully_released" }
  | { step: "can_release"; remainingCap: bigint }
  | { step: "can_route" }
  | { step: "paid" };

export function deriveOperatorStep(r: OperatorReads): OperatorStep {
  if (r.routed) return { step: "paid" };
  if (r.hasPendingPayout) return { step: "can_route" };
  if (r.donated === 0n) return { step: "awaiting_donations" };
  if (!r.canRelease) return { step: "needs_trigger", releaseType: r.releaseType };

  const unlockAt = r.activatedAt + r.releaseDelay;
  if (r.now < unlockAt) return { step: "awaiting_unlock", unlockAt };

  const remainingCap = r.donated - r.released;
  if (remainingCap <= 0n) return { step: "fully_released" };
  return { step: "can_release", remainingCap };
}
