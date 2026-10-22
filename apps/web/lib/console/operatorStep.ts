import type { ReleaseType } from "@amanah/shared";

// Pure derivation of "where is this campaign in the operator flow" from chain reads
// (+ the two session booleans for the route/paid tail). One tested function instead of
// scattered per-card booleans. Exhaustiveness is enforced at the consumer by
// `STEP_LABEL: Record<OperatorStep["step"], string>` (CampaignStatePanel) — adding a step
// breaks that compile. Cards read their own numbers (remainingCap, unlockAt, releaseType)
// from the hooks, so the step is a plain tag and carries no payload. Invest-idle and accrue
// are always-available side actions, NOT steps.

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

export type OperatorStepName =
  | "awaiting_donations"
  | "needs_trigger"
  | "awaiting_unlock"
  | "fully_released"
  | "can_release"
  | "can_route"
  | "paid";

export type OperatorStep = { step: OperatorStepName };

export function deriveOperatorStep(r: OperatorReads): OperatorStep {
  if (r.routed) return { step: "paid" };
  if (r.hasPendingPayout) return { step: "can_route" };
  if (r.donated === 0n) return { step: "awaiting_donations" };
  if (!r.canRelease) return { step: "needs_trigger" };
  if (r.now < r.activatedAt + r.releaseDelay) return { step: "awaiting_unlock" };
  if (r.donated - r.released <= 0n) return { step: "fully_released" };
  return { step: "can_release" };
}
