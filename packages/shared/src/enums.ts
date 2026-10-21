import { z } from "zod";

// z.enum (not a TS `enum`): a TS enum is a runtime object that tree-shakes
// poorly and is awkward across the ESM/CJS dual build. z.enum gives both a
// runtime validator and an inferred string-union type.

/** Mirrors the on-chain `IReleaseController.ReleaseType` enum. */
export const ReleaseType = z.enum(["PARAMETRIC", "MILESTONE"]);
export type ReleaseType = z.infer<typeof ReleaseType>;

/**
 * Index MUST match the Solidity enum's ordinal order. `as const satisfies` only
 * checks MEMBERSHIP, not order — a reorder still compiles. The ordinal order is
 * instead pinned by a runtime test (RELEASE_TYPE_LABEL equals the expected array)
 * and the TS/Foundry keccak parity tests; keep those in sync with the contract.
 */
export const RELEASE_TYPE_LABEL = [
  "PARAMETRIC",
  "MILESTONE",
] as const satisfies readonly ReleaseType[];

/** Decode a `ReleaseType` from its on-chain uint8 ordinal. */
export function releaseTypeFromOrdinal(ordinal: number): ReleaseType {
  const label = RELEASE_TYPE_LABEL[ordinal];
  if (label === undefined) {
    throw new Error(`unknown ReleaseType ordinal: ${ordinal}`);
  }
  return label;
}

/** Charity cause catalog. Stored as a plain String column (growable), validated here. */
export const CampaignType = z.enum([
  "disaster",
  "education",
  "medical",
  "poverty",
  "waqf",
  "general",
]);
export type CampaignType = z.infer<typeof CampaignType>;

/** DonationLog lifecycle. `expired` is set by the auto-expire sweep. */
export const DonationStatus = z.enum(["pending", "confirmed", "expired"]);
export type DonationStatus = z.infer<typeof DonationStatus>;

/**
 * PayoutDecision lifecycle — DERIVED from write-once fact columns, not stored
 * as an independently-mutated column. Monotonic rank pending<released<routed;
 * `cancelled` is terminal.
 */
export const PayoutStatus = z.enum([
  "pending",
  "released",
  "routed",
  "cancelled",
  // Set by the auto-expire sweep for optimistic payout intents that never
  // received an on-chain TrancheReleased/Routed (not an on-chain fact).
  "expired",
]);
export type PayoutStatus = z.infer<typeof PayoutStatus>;
